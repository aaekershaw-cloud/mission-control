import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { triggerQueueIfNeeded } from '@/lib/autoQueue';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const row = db.prepare(`
      SELECT t.*, a.name AS assignee_name, a.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(id) as Record<string, unknown> | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_name ?? null,
      assigneeAvatar: row.assignee_avatar ?? null,
      squadId: row.squad_id,
      tags: JSON.parse((row.tags as string) || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      estimatedTokens: row.estimated_tokens,
      actualTokens: row.actual_tokens,
      dependsOn: row.depends_on ?? '',
      chainContext: row.chain_context ?? '',
    });
  } catch (error) {
    console.error('GET /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch task' },
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

    const existing = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const allowedFields: Record<string, string> = {
      title: 'title',
      description: 'description',
      status: 'status',
      priority: 'priority',
      assigneeId: 'assignee_id',
      squadId: 'squad_id',
      estimatedTokens: 'estimated_tokens',
      actualTokens: 'actual_tokens',
      chainContext: 'chain_context',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [camel, snake] of Object.entries(allowedFields)) {
      if (camel in body) {
        setClauses.push(`${snake} = ?`);
        values.push(body[camel]);
      }
    }

    if ('tags' in body) {
      setClauses.push('tags = ?');
      values.push(JSON.stringify(body.tags));
    }

    if ('dependsOn' in body) {
      setClauses.push('depends_on = ?');
      const dep = body.dependsOn;
      values.push(Array.isArray(dep) ? dep.join(',') : (dep || ''));
    }

    // Handle status change to 'done'
    const newStatus = body.status;
    const oldStatus = existing.status;
    if (newStatus === 'done' && oldStatus !== 'done') {
      setClauses.push("completed_at = datetime('now')");
      // Increment agent's tasks_completed if assigned
      const assigneeId = body.assigneeId ?? existing.assignee_id;
      if (assigneeId) {
        db.prepare(
          'UPDATE agents SET tasks_completed = tasks_completed + 1, updated_at = datetime(\'now\') WHERE id = ?'
        ).run(assigneeId);
      }
    }

    // If status changed away from 'done', clear completed_at
    if (newStatus && newStatus !== 'done' && oldStatus === 'done') {
      setClauses.push('completed_at = NULL');
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    setClauses.push("updated_at = datetime('now')");
    values.push(id);

    db.prepare(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...values);

    // Auto-start queue if task moved to todo
    if (newStatus === 'todo') {
      triggerQueueIfNeeded();
    }

    const row = db.prepare(`
      SELECT t.*, a.name AS assignee_name, a.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(id) as Record<string, unknown>;

    return NextResponse.json({
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      priority: row.priority,
      assigneeId: row.assignee_id,
      assigneeName: row.assignee_name ?? null,
      assigneeAvatar: row.assignee_avatar ?? null,
      squadId: row.squad_id,
      tags: JSON.parse((row.tags as string) || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      estimatedTokens: row.estimated_tokens,
      actualTokens: row.actual_tokens,
      dependsOn: row.depends_on ?? '',
      chainContext: row.chain_context ?? '',
    });
  } catch (error) {
    console.error('PUT /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update task' },
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

    const existing = db.prepare('SELECT id FROM tasks WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    db.prepare('DELETE FROM tasks WHERE id = ?').run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}
