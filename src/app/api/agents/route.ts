import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const squadId = searchParams.get('squadId');

    let query = `
      SELECT a.*,
        t.id AS current_task_id_ref,
        t.title AS current_task_title,
        t.status AS current_task_status
      FROM agents a
      LEFT JOIN tasks t ON a.current_task_id = t.id
      WHERE 1=1
    `;
    const params: string[] = [];

    if (status) {
      query += ' AND a.status = ?';
      params.push(status);
    }
    if (squadId) {
      query += ' AND a.squad_id = ?';
      params.push(squadId);
    }

    query += ' ORDER BY a.created_at ASC';

    const rows = db.prepare(query).all(...params) as Record<string, unknown>[];

    const agents = rows.map((row) => ({
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
    }));

    return NextResponse.json(agents);
  } catch (error) {
    console.error('GET /api/agents error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch agents' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      name,
      codename,
      avatar = '🤖',
      role,
      personality = '',
      soul = '',
      provider = 'kimi-k2.5',
      model = 'moonshotai/kimi-k2.5',
      squadId = null,
    } = body;

    if (!name || !codename || !role) {
      return NextResponse.json(
        { error: 'name, codename, and role are required' },
        { status: 400 }
      );
    }

    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO agents (id, name, codename, avatar, role, status, personality, soul, provider, model, squad_id, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 'offline', ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, name, codename, avatar, role, personality, soul, provider, model, squadId, now, now);

    const row = db.prepare('SELECT * FROM agents WHERE id = ?').get(id) as Record<string, unknown>;

    return NextResponse.json(
      {
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
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/agents error:', error);
    return NextResponse.json(
      { error: 'Failed to create agent' },
      { status: 500 }
    );
  }
}
