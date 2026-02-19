import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const { tasks } = body;

    if (!Array.isArray(tasks) || tasks.length === 0) {
      return NextResponse.json({ error: 'tasks array is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const created: string[] = [];

    // Insert tasks one by one (PostgreSQL doesn't have same transaction pattern as SQLite)
    for (const t of tasks) {
      const id = uuid();
      const tags = Array.isArray(t.tags) ? JSON.stringify(t.tags) : '[]';
      const dependsOn = Array.isArray(t.dependsOn) ? t.dependsOn.join(',') : (t.dependsOn || '');
      await db.run(
        `INSERT INTO tasks (id, title, description, status, priority, assignee_id, squad_id, tags, estimated_tokens, depends_on, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
        [
          id,
          t.title || 'Untitled',
          t.description || '',
          t.status || 'todo',
          t.priority || 'medium',
          t.assigneeId || null,
          t.squadId || null,
          tags,
          t.estimatedTokens || 0,
          dependsOn,
          now,
          now
        ]
      );
      created.push(id);
    }

    return NextResponse.json({ ok: true, created: created.length, ids: created }, { status: 201 });
  } catch (error) {
    console.error('POST /api/tasks/bulk error:', error);
    return NextResponse.json({ error: 'Failed to create tasks' }, { status: 500 });
  }
}
