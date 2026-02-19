import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    // Get tasks assigned to this agent
    const tasks = db.prepare(`
      SELECT t.*, tr.response, tr.tokens_used as result_tokens, tr.cost_usd as result_cost,
             tr.duration_ms, tr.status as result_status, tr.created_at as result_created_at
      FROM tasks t
      LEFT JOIN task_results tr ON t.id = tr.task_id AND tr.id = (
        SELECT tr2.id FROM task_results tr2 WHERE tr2.task_id = t.id ORDER BY tr2.created_at DESC LIMIT 1
      )
      WHERE t.assignee_id = ?
      ORDER BY t.updated_at DESC
    `).all(id) as Record<string, unknown>[];

    const result = tasks.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      status: t.status,
      priority: t.priority,
      tags: (() => { try { return JSON.parse((t.tags as string) || '[]'); } catch { return []; } })(),
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      completedAt: t.completed_at,
      result: t.response ? {
        response: (t.response as string).substring(0, 500),
        tokensUsed: t.result_tokens,
        costUsd: t.result_cost,
        durationMs: t.duration_ms,
        status: t.result_status,
        createdAt: t.result_created_at,
      } : null,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('GET /api/agents/[id]/tasks error:', error);
    return NextResponse.json({ error: 'Failed to fetch agent tasks' }, { status: 500 });
  }
}
