import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId } = body;
    let providerConfig = body.providerConfig;

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    // If no providerConfig from client, load from server DB
    if (!providerConfig) {
      const db2 = getDb();
      const serverProvider = db2.prepare('SELECT * FROM provider_configs WHERE is_default = 1').get() as Record<string, unknown> | undefined
        || db2.prepare('SELECT * FROM provider_configs WHERE api_key != "" LIMIT 1').get() as Record<string, unknown> | undefined;
      
      if (serverProvider && serverProvider.api_key) {
        providerConfig = {
          type: serverProvider.type,
          baseUrl: serverProvider.base_url,
          apiKey: serverProvider.api_key,
          model: serverProvider.model,
          maxTokens: serverProvider.max_tokens || 8192,
        };
      }
    }

    if (!providerConfig) {
      return NextResponse.json({ error: 'No provider configured. Add one via /api/providers or pass providerConfig.' }, { status: 400 });
    }

    const db = getDb();

    // Load task
    const task = db.prepare(`
      SELECT t.*, a.id as agent_id, a.name as agent_name, a.avatar as agent_avatar,
             a.role as agent_role, a.personality as agent_personality, a.soul as agent_soul
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(taskId) as any;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.agent_id) {
      return NextResponse.json({ error: 'No agent assigned to this task' }, { status: 400 });
    }

    const agentId = task.agent_id;

    // Update statuses
    db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('in_progress', taskId);
    db.prepare('UPDATE agents SET status = ?, current_task_id = ?, updated_at = datetime(\'now\') WHERE id = ?').run('busy', taskId, agentId);

    // Build prompt
    const systemPrompt = [
      task.agent_soul || '',
      task.agent_personality ? `\nPersonality: ${task.agent_personality}` : '',
      task.agent_role ? `\nRole: ${task.agent_role}` : '',
    ].filter(Boolean).join('\n');

    const userPrompt = `Task: ${task.title}\n\n${task.description || 'No additional description provided.'}`;

    // Call LLM
    const startTime = Date.now();
    let response: string;
    let tokensUsed = 0;

    try {
      const { type, baseUrl, apiKey, model, maxTokens } = providerConfig;

      if (type === 'claude') {
        const res = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens || 4096,
            system: systemPrompt,
            messages: [{ role: 'user', content: userPrompt }],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Claude API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        response = data.content?.[0]?.text || '';
        tokensUsed = (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
      } else {
        // openai / kimi-k2.5 / custom
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model,
            max_tokens: maxTokens || 4096,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: userPrompt },
            ],
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`LLM API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        response = data.choices?.[0]?.message?.content || '';
        tokensUsed = (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
      }
    } catch (err: any) {
      // On error, reset statuses
      db.prepare('UPDATE tasks SET status = ?, updated_at = datetime(\'now\') WHERE id = ?').run('todo', taskId);
      db.prepare('UPDATE agents SET status = ?, current_task_id = NULL, updated_at = datetime(\'now\') WHERE id = ?').run('online', agentId);

      const resultId = uuid();
      const durationMs = Date.now() - startTime;
      db.prepare(`
        INSERT INTO task_results (id, task_id, agent_id, prompt, response, tokens_used, cost_usd, duration_ms, status)
        VALUES (?, ?, ?, ?, ?, 0, 0, ?, 'error')
      `).run(resultId, taskId, agentId, userPrompt, err.message, durationMs);

      return NextResponse.json({ error: err.message }, { status: 500 });
    }

    const durationMs = Date.now() - startTime;
    const costUsd = tokensUsed * 0.000005; // rough average estimate

    // Store result
    const resultId = uuid();
    db.prepare(`
      INSERT INTO task_results (id, task_id, agent_id, prompt, response, tokens_used, cost_usd, duration_ms, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'completed')
    `).run(resultId, taskId, agentId, userPrompt, response, tokensUsed, costUsd, durationMs);

    // Update task & agent
    db.prepare('UPDATE tasks SET status = ?, actual_tokens = actual_tokens + ?, updated_at = datetime(\'now\') WHERE id = ?')
      .run('review', tokensUsed, taskId);
    db.prepare(`
      UPDATE agents SET status = 'online', current_task_id = NULL,
        tokens_used = tokens_used + ?, cost_usd = cost_usd + ?,
        tasks_completed = tasks_completed + 1, updated_at = datetime('now')
      WHERE id = ?
    `).run(tokensUsed, costUsd, agentId);

    // Create system message
    const msgId = uuid();
    const summary = `✅ Completed task "${task.title}" in ${(durationMs / 1000).toFixed(1)}s using ${tokensUsed} tokens ($${costUsd.toFixed(4)})`;
    db.prepare(`
      INSERT INTO messages (id, from_agent_id, content, type) VALUES (?, ?, ?, 'system')
    `).run(msgId, agentId, summary);

    return NextResponse.json({
      id: resultId,
      taskId,
      agentId,
      agentName: task.agent_name,
      agentAvatar: task.agent_avatar,
      prompt: userPrompt,
      response,
      tokensUsed,
      costUsd,
      durationMs,
      status: 'completed',
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
