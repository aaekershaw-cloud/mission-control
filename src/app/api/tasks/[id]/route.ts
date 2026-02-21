import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { triggerQueueIfNeeded } from '@/lib/autoQueue';
import { notifyAgent, notifyTaskSubscribers } from '@/lib/notifications';
import { getAgentTodoCount, LOOP_LIMITS } from '@/lib/loopControls';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const row = await db.get(`
      SELECT t.*, a.name AS assignee_name, a.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = $1
    `, [id]) as Record<string, unknown> | null;

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
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags as string) : []),
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

    const existing = await db.get('SELECT * FROM tasks WHERE id = $1', [id]) as Record<string, unknown> | null;
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
    let paramIndex = 1;

    for (const [camel, snake] of Object.entries(allowedFields)) {
      if (camel in body) {
        setClauses.push(`${snake} = $${paramIndex}`);
        values.push(body[camel]);
        paramIndex++;
      }
    }

    if ('tags' in body) {
      setClauses.push(`tags = $${paramIndex}`);
      values.push(JSON.stringify(body.tags));
      paramIndex++;
    }

    if ('dependsOn' in body) {
      setClauses.push(`depends_on = $${paramIndex}`);
      const dep = body.dependsOn;
      values.push(Array.isArray(dep) ? dep.join(',') : (dep || ''));
      paramIndex++;
    }

    // Handle status change to 'done'
    const newStatus = body.status;
    const oldStatus = existing.status;
    if (newStatus === 'done' && oldStatus !== 'done') {
      setClauses.push('completed_at = NOW()');
      // Increment agent's tasks_completed if assigned
      const assigneeId = body.assigneeId ?? existing.assignee_id;
      if (assigneeId) {
        await db.run(
          'UPDATE agents SET tasks_completed = tasks_completed + 1, updated_at = NOW() WHERE id = $1',
          [assigneeId]
        );
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

    // Enforce per-agent todo cap
    if (newStatus === 'todo') {
      const targetAssignee = (body.assigneeId ?? existing.assignee_id) as string | null;
      if (targetAssignee) {
        const todoCount = await getAgentTodoCount(targetAssignee);
        if (todoCount >= LOOP_LIMITS.maxTodoPerAgent && oldStatus !== 'todo') {
          return NextResponse.json(
            { error: `Assignee reached todo cap (${LOOP_LIMITS.maxTodoPerAgent}). Move to backlog or clear queue first.` },
            { status: 409 }
          );
        }
      }
    }

    setClauses.push('updated_at = NOW()');
    values.push(id); // Add id as the final parameter

    await db.run(
      `UPDATE tasks SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`,
      values
    );

    // Auto-start queue if task moved to todo
    if (newStatus === 'todo') {
      await triggerQueueIfNeeded();
    }

    // Notify assignee/subscribers on status changes (e.g., drag between kanban columns)
    if (newStatus && newStatus !== oldStatus) {
      const assigneeId = (body.assigneeId ?? existing.assignee_id) as string | null;
      const sourceAgentId = 'system';
      const msg = `📌 Task status updated: **${existing.title as string}** moved from **${String(oldStatus)}** to **${String(newStatus)}**.`;
      if (assigneeId) {
        await notifyAgent(assigneeId, msg, id, sourceAgentId);
      }
      await notifyTaskSubscribers(id, msg, sourceAgentId);
    }

    const row = await db.get(`
      SELECT t.*, a.name AS assignee_name, a.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = $1
    `, [id]) as Record<string, unknown>;

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
      tags: Array.isArray(row.tags) ? row.tags : (row.tags ? JSON.parse(row.tags as string) : []),
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

    const existing = await db.get('SELECT id FROM tasks WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    await db.run('DELETE FROM tasks WHERE id = $1', [id]);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/tasks/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to delete task' },
      { status: 500 }
    );
  }
}