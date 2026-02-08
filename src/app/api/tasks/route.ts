import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

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

    if (status) {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (assigneeId) {
      query += ' AND t.assignee_id = ?';
      params.push(assigneeId);
    }
    if (squadId) {
      query += ' AND t.squad_id = ?';
      params.push(squadId);
    }

    query += ' ORDER BY t.created_at DESC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

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
      tags: JSON.parse((row.tags as string) || '[]'),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      completedAt: row.completed_at,
      estimatedTokens: row.estimated_tokens,
      actualTokens: row.actual_tokens,
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
    } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'title is required' },
        { status: 400 }
      );
    }

    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO tasks (id, title, description, status, priority, assignee_id, squad_id, tags, estimated_tokens, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, title, description, status, priority, assigneeId, squadId, JSON.stringify(tags), estimatedTokens, now, now);

    const row = db.prepare(`
      SELECT t.*, a.name AS assignee_name, a.avatar AS assignee_avatar
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = ?
    `).get(id) as Record<string, unknown>;

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
        tags: JSON.parse((row.tags as string) || '[]'),
        createdAt: row.created_at,
        updatedAt: row.updated_at,
        completedAt: row.completed_at,
        estimatedTokens: row.estimated_tokens,
        actualTokens: row.actual_tokens,
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
