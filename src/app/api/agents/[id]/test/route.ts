import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const { prompt } = await request.json();

    if (!prompt) {
      return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    const agent = await db.get('SELECT * FROM agents WHERE id = $1', [id]) as Record<string, string> | undefined;
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    // Get provider
    const provider = (await db.get(
      `SELECT * FROM provider_configs WHERE type = $1 AND api_key != '' LIMIT 1`,
      [agent.provider]
    ) as Record<string, string | number> | undefined)
      ?? (await db.get(
        `SELECT * FROM provider_configs WHERE is_default = true AND api_key != '' LIMIT 1`,
        []
      ) as Record<string, string | number> | undefined);

    if (!provider) {
      return NextResponse.json({ error: 'No provider configured' }, { status: 500 });
    }

    const systemPrompt = [
      agent.soul || '',
      agent.personality ? `\nPersonality: ${agent.personality}` : '',
      agent.role ? `\nRole: ${agent.role}` : '',
    ].filter(Boolean).join('\n');

    const startTime = Date.now();

    const res = await fetch(`${provider.base_url}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${provider.api_key}`,
      },
      body: JSON.stringify({
        model: provider.model,
        max_tokens: 4096,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return NextResponse.json({ error: `API error: ${errText}` }, { status: 502 });
    }

    const data = await res.json();
    const response = data.choices?.[0]?.message?.content || '';
    const tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      response,
      tokensUsed,
      durationMs,
      model: provider.model,
    });
  } catch (error) {
    console.error('POST /api/agents/[id]/test error:', error);
    return NextResponse.json({ error: 'Test execution failed' }, { status: 500 });
  }
}
