import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { triggerQueueIfNeeded } from '@/lib/autoQueue';
import { v4 as uuid } from 'uuid';
import { findDuplicateTask, getAgentTodoCount, inferContentCategory, shouldGateCategory, getLoopLimits } from '@/lib/loopControls';
import { logActivity } from '@/lib/activityLog';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const assigneeId = searchParams.get('assigneeId');
    const squadId = searchParams.get('squadId');

    let query = `
      SELECT t.*,
        a.name AS assignee_name,
        a.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE 1=1
    `;
    const params: string[] = [];
    let paramIndex = 1;

    if (status) {
      query += ` AND t.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    if (assigneeId) {
      query += ` AND t.assignee_id = $${paramIndex}`;
      params.push(assigneeId);
      paramIndex++;
    }
    if (squadId) {
      query += ` AND t.squad_id = $${paramIndex}`;
      params.push(squadId);
      paramIndex++;
    }

    query += ' ORDER BY t.created_at DESC';

    const rows = await db.all(query, params) as Record<string, unknown>[];

    const tasks = rows.map((row) => ({
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
    }));

    return NextResponse.json(tasks);
  } catch (error) {
    console.error('GET /api/tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tasks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      title,
      description = '',
      status = 'backlog',
      priority = 'medium',
      assigneeId = null,
      squadId = null,
      tags = [],
      estimatedTokens = 0,
      dependsOn = '',
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    // Dedup guard
    const duplicate = await findDuplicateTask(title, assigneeId);
    if (duplicate) {
      await logActivity('system', `Dedup blocked task create: ${title}`, `Duplicate of ${duplicate.id}`, assigneeId || undefined, { duplicateId: duplicate.id });
      return NextResponse.json({ error: 'Duplicate task blocked', duplicateTaskId: duplicate.id }, { status: 409 });
    }

    // Backlog-aware gating by content type (staging pressure)
    const inferredCategory = inferContentCategory(title, Array.isArray(tags) ? tags : []);
    const gated = await shouldGateCategory(inferredCategory);

    // Per-agent WIP cap for todo
    let finalStatus = status;
    if (assigneeId && finalStatus === 'todo') {
      const limits = await getLoopLimits();
      const todoCount = await getAgentTodoCount(assigneeId);
      if (todoCount >= limits.maxTodoPerAgent) {
        finalStatus = 'backlog';
      }
    }

    if (gated && ['todo', 'backlog'].includes(finalStatus)) {
      finalStatus = 'backlog';
    }

    const id = uuid();
    const now = new Date().toISOString();
    // dependsOn can be string (comma-sep IDs) or array
    const dependsOnStr = Array.isArray(dependsOn) ? dependsOn.join(',') : (dependsOn || '');

    await db.run(
      `INSERT INTO tasks (id, title, description, status, priority, assignee_id, squad_id, tags, estimated_tokens, depends_on, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [id, title, description, finalStatus, priority, assigneeId, squadId, JSON.stringify(tags), estimatedTokens, dependsOnStr, now, now]
    );

    const row = await db.get(`
      SELECT t.*, a.name AS assignee_name, a.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = $1
    `, [id]) as Record<string, unknown>;

    // Create calendar event for the task
    await db.run(
      'INSERT INTO calendar_events (id, title, description, event_type, start_time, metadata) VALUES ($1, $2, $3, $4, NOW(), $5)',
      [uuid(), `Task: ${title}`, description.substring(0, 200), 'task', JSON.stringify({ taskId: id })]
    );

    // Auto-start queue if task created as todo
    if (finalStatus === 'todo') {
      await triggerQueueIfNeeded();
    }

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/tasks error:', error);
    return NextResponse.json(
      { error: 'Failed to create task' },
      { status: 500 }
    );
  }
}