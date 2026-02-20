import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getToolsForAgent, executeTool } from '@/lib/agentTools';
import { logActivity } from '@/lib/activityLog';

/**
 * POST /api/content-pipeline/revise
 * Triggers the assigned agent to revise a content pipeline item.
 * Body: { id: string, notes: string }
 */
export async function POST(request: NextRequest) {
  const { id, notes } = await request.json();
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const db = getDb();

  // Load the content item
  const item = await db.get(`
    SELECT cp.*, a.name as agent_name, a.avatar as agent_avatar, a.codename as agent_codename,
           a.soul as agent_soul, a.role as agent_role, a.personality as agent_personality,
           a.provider as agent_provider
    FROM content_pipeline cp
    LEFT JOIN agents a ON cp.assigned_agent_id = a.id
    WHERE cp.id = $1
  `, [id]) as Record<string, any> | undefined;

  if (!item) return NextResponse.json({ error: 'Content not found' }, { status: 404 });

  // Find a provider
  const provider = await db.get(
    `SELECT * FROM provider_configs WHERE api_key != '' ORDER BY is_default DESC LIMIT 1`
  ) as Record<string, any> | undefined;

  if (!provider) return NextResponse.json({ error: 'No LLM provider configured' }, { status: 500 });

  // Update stage to writing
  await db.run(`UPDATE content_pipeline SET stage = 'writing', notes = $1, updated_at = NOW() WHERE id = $2`, [notes || '', id]);

  await logActivity('content', `Content revision started: ${item.title}`, notes || '', item.assigned_agent_id, { itemId: id });

  // Run agent in background (don't block the response)
  runRevision(item, notes || '', provider).catch(err => {
    console.error('[ContentRevise] Agent execution failed:', err);
  });

  return NextResponse.json({ ok: true, message: 'Revision triggered — agent is working on it.' });
}

async function runRevision(item: Record<string, any>, notes: string, provider: Record<string, any>) {
  const db = getDb();

  const systemPrompt = [
    item.agent_soul || 'You are a social media content specialist for FretCoach.ai, a guitar learning platform.',
    item.agent_role ? `\nRole: ${item.agent_role}` : '',
    item.agent_personality ? `\nPersonality: ${item.agent_personality}` : '',
    `\nBrand: FretCoach.ai — AI-powered guitar learning. Colors: amber #f59e0b on dark. Target: intermediate guitarists.`,
    `\nYou have tools available. Use generate_image if the content needs a new image. Use delegate_task to recruit other agents if you need specialized help (e.g. TabSmith for tab notation, TheoryBot for music theory accuracy).`,
    `\nReturn ONLY the revised caption/content text. Do not include explanations or meta-commentary.`,
  ].join('\n');

  const userPrompt = `## Content Revision Request

**Platform:** ${item.platform}
**Original title:** ${item.title}

**Original content:**
${item.body || '(empty)'}

**Revision notes from reviewer:**
${notes}

${item.platform === 'x' ? '\n⚠️ X/Twitter limit: 280 characters. Keep it tight.' : ''}
${item.platform === 'instagram' ? '\nInclude relevant hashtags at the end.' : ''}

Please revise the content based on the feedback above. Return ONLY the revised content text.`;

  const agentCodename = item.agent_codename || 'CONTENTMILL';
  const tools = getToolsForAgent(agentCodename);

  try {
    let response = '';
    let newImageUrl: string | null = null;

    if (provider.type === 'claude') {
      const messages: any[] = [{ role: 'user', content: userPrompt }];
      let maxRounds = 8;
      let currentRound = 0;

      while (currentRound < maxRounds) {
        currentRound++;
        const requestBody: any = {
          model: provider.model,
          max_tokens: provider.max_tokens || 4096,
          system: systemPrompt,
          messages,
        };
        if (tools.claude.length > 0) requestBody.tools = tools.claude;

        const res = await fetch(`${provider.base_url || 'https://api.anthropic.com'}/v1/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': provider.api_key,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Claude API error ${res.status}: ${err}`);
        }

        const data = await res.json();
        const toolUseBlocks = data.content.filter((b: any) => b.type === 'tool_use');
        const textBlocks = data.content.filter((b: any) => b.type === 'text');

        if (textBlocks.length > 0) {
          response = textBlocks.map((b: any) => b.text).join('\n');
        }

        if (toolUseBlocks.length === 0 || data.stop_reason !== 'tool_use') break;

        // Execute tools
        messages.push({ role: 'assistant', content: data.content });
        const toolResults: any[] = [];
        for (const toolBlock of toolUseBlocks) {
          try {
            const result = await executeTool(toolBlock.name, toolBlock.input);
            // Capture image URL if generate_image was used
            if (toolBlock.name === 'generate_image' && result?.url) {
              newImageUrl = result.url;
            }
            toolResults.push({ type: 'tool_result', tool_use_id: toolBlock.id, content: JSON.stringify(result) });
          } catch (err: any) {
            toolResults.push({ type: 'tool_result', tool_use_id: toolBlock.id, content: `Error: ${err.message}`, is_error: true });
          }
        }
        messages.push({ role: 'user', content: toolResults });
      }
    } else {
      // OpenAI-compatible
      const messages: any[] = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ];
      let maxRounds = 8;
      let currentRound = 0;

      while (currentRound < maxRounds) {
        currentRound++;
        const requestBody: any = { model: provider.model, messages, max_tokens: provider.max_tokens || 4096 };
        if (tools.openai.length > 0) requestBody.tools = tools.openai;

        const res = await fetch(`${provider.base_url}/v1/chat/completions`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${provider.api_key}` },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const err = await res.text();
          throw new Error(`API error ${res.status}: ${err}`);
        }

        const data = await res.json();
        const choice = data.choices[0];

        if (choice.message.content) response = choice.message.content;

        if (!choice.message.tool_calls || choice.finish_reason !== 'tool_calls') break;

        messages.push(choice.message);
        for (const tc of choice.message.tool_calls) {
          try {
            const params = JSON.parse(tc.function.arguments);
            const result = await executeTool(tc.function.name, params);
            if (tc.function.name === 'generate_image' && result?.url) newImageUrl = result.url;
            messages.push({ role: 'tool', tool_call_id: tc.id, content: JSON.stringify(result) });
          } catch (err: any) {
            messages.push({ role: 'tool', tool_call_id: tc.id, content: `Error: ${err.message}` });
          }
        }
      }
    }

    // Clean up response — strip markdown fences, headers, etc.
    const cleanBody = response
      .replace(/^```[\s\S]*?```$/gm, (m) => m.replace(/^```\w*\n?/, '').replace(/\n?```$/, ''))
      .replace(/^#+\s*/gm, '')
      .replace(/^\*\*Revised.*?\*\*\s*\n*/i, '')
      .trim();

    // Update the content pipeline item
    const updates: any = {
      body: cleanBody,
      stage: 'review',
      notes: `Revised based on feedback: ${notes}`,
    };

    if (newImageUrl) {
      updates.thumbnail_url = newImageUrl;
    }

    const setClauses = Object.keys(updates).map((k, i) => `${k} = $${i + 1}`);
    setClauses.push(`updated_at = NOW()`);
    const vals = [...Object.values(updates), item.id];

    await db.run(
      `UPDATE content_pipeline SET ${setClauses.join(', ')} WHERE id = $${vals.length}`,
      vals
    );

    await logActivity('content', `Content revised: ${item.title}`, cleanBody.substring(0, 200), item.assigned_agent_id, {
      itemId: item.id,
      hadNewImage: !!newImageUrl,
    });

    console.log(`[ContentRevise] ✅ Revised "${item.title}" — moved back to review`);
  } catch (err) {
    console.error(`[ContentRevise] ❌ Failed to revise "${item.title}":`, err);
    // Move back to review with error note so it doesn't get stuck in writing
    await db.run(
      `UPDATE content_pipeline SET stage = 'review', notes = $1, updated_at = NOW() WHERE id = $2`,
      [`Revision failed: ${err instanceof Error ? err.message : 'Unknown error'}. Original feedback: ${notes}`, item.id]
    );
  }
}
