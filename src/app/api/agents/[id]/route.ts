import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const row = await db.get(`
      SELECT a.*,
        t.id AS current_task_id_ref,
        t.title AS current_task_title,
        t.status AS current_task_status
      FROM agents a
      LEFT JOIN tasks t ON a.current_task_id = t.id
      WHERE a.id = $1
    `, [id]) as Record<string, unknown> | null;

    if (!row) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      name: row.name,
      codename: row.codename,
      avatar: row.avatar,
      role: row.role,
      status: row.status,
      personality: row.personality,
      soul: row.soul,
      provider: row.provider,
      model: row.model,
      squadId: row.squad_id,
      lastHeartbeat: row.last_heartbeat,
      tasksCompleted: row.tasks_completed,
      tokensUsed: row.tokens_used,
      costUsd: row.cost_usd,
      currentTaskId: row.current_task_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      currentTask: row.current_task_id_ref
        ? {
            id: row.current_task_id_ref,
            title: row.current_task_title,
            status: row.current_task_status,
          }
        : null,
    });
  } catch (error) {
    console.error('GET /api/agents/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agent' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.get('SELECT id FROM agents WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const allowedFields: Record<string, string> = {
      name: 'name',
      codename: 'codename',
      avatar: 'avatar',
      role: 'role',
      status: 'status',
      personality: 'personality',
      soul: 'soul',
      provider: 'provider',
      model: 'model',
      squadId: 'squad_id',
      currentTaskId: 'current_task_id',
      tokensUsed: 'tokens_used',
      costUsd: 'cost_usd',
      tasksCompleted: 'tasks_completed',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    for (const [camel, snake] of Object.entries(allowedFields)) {
      if (camel in body) {
        setClauses.push(`${snake} = $${paramIndex}`);
        values.push(body[camel]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    setClauses.push('updated_at = NOW()');
    values.push(id);

    await db.run(
      `UPDATE agents SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    const row = await db.get('SELECT * FROM agents WHERE id = $1', [id]) as Record<string, unknown>;

    return NextResponse.json({
      id: row.id,
      name: row.name,
      codename: row.codename,
      avatar: row.avatar,
      role: row.role,
      status: row.status,
      personality: row.personality,
      soul: row.soul,
      provider: row.provider,
      model: row.model,
      squadId: row.squad_id,
      lastHeartbeat: row.last_heartbeat,
      tasksCompleted: row.tasks_completed,
      tokensUsed: row.tokens_used,
      costUsd: row.cost_usd,
      currentTaskId: row.current_task_id,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    });
  } catch (error) {
    console.error('PUT /api/agents/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update agent' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const existing = await db.get('SELECT id FROM agents WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    await db.run('DELETE FROM agents WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/agents/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete agent' },
      { status: 500 }
    );
  }
}