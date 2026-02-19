import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET() {
  try {
    const db = getDb();

    const results = await db.all(`
      SELECT tr.*, a.name as agent_name, a.avatar as agent_avatar
      FROM task_results tr
      LEFT JOIN agents a ON tr.agent_id = a.id
      ORDER BY tr.created_at DESC
      LIMIT 50
    `, []);

    const mapped = results.map((r: any) => ({
      id: r.id,
      taskId: r.task_id,
      agentId: r.agent_id,
      agentName: r.agent_name,
      agentAvatar: r.agent_avatar,
      prompt: r.prompt,
      response: r.response,
      tokensUsed: r.tokens_used,
      costUsd: r.cost_usd,
      durationMs: r.duration_ms,
      status: r.status,
      createdAt: r.created_at,
    }));

    return NextResponse.json(mapped);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
