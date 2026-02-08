import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const rows = db.prepare(`
      SELECT h.*, a.name AS agent_name, a.avatar AS agent_avatar, a.codename AS agent_codename
      FROM heartbeats h
      LEFT JOIN agents a ON h.agent_id = a.id
      ORDER BY h.timestamp DESC
      LIMIT ?
    `).all(limit) as Record<string, unknown>[];

    const heartbeats = rows.map((row) => ({
      id: row.id,
      agentId: row.agent_id,
      agentName: row.agent_name ?? null,
      agentAvatar: row.agent_avatar ?? null,
      agentCodename: row.agent_codename ?? null,
      status: row.status,
      timestamp: row.timestamp,
      taskProgress: row.task_progress,
      memoryUsage: row.memory_usage,
      tokensUsedSession: row.tokens_used_session,
    }));

    return NextResponse.json(heartbeats);
  } catch (error) {
    console.error('GET /api/heartbeat error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch heartbeats' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      agentId,
      status,
      taskProgress = 0,
      memoryUsage = 0,
      tokensUsedSession = 0,
    } = body;

    if (!agentId || !status) {
      return NextResponse.json(
        { error: 'agentId and status are required' },
        { status: 400 }
      );
    }

    // Verify agent exists
    const agent = db.prepare('SELECT id FROM agents WHERE id = ?').get(agentId);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Insert heartbeat record
    db.prepare(
      `INSERT INTO heartbeats (agent_id, status, timestamp, task_progress, memory_usage, tokens_used_session)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(agentId, status, now, taskProgress, memoryUsage, tokensUsedSession);

    // Update agent's last_heartbeat and status
    db.prepare(
      "UPDATE agents SET last_heartbeat = ?, status = ?, updated_at = datetime('now') WHERE id = ?"
    ).run(now, status, agentId);

    // Fetch pending tasks assigned to this agent
    const pendingTasks = db.prepare(
      "SELECT id, title, status, priority FROM tasks WHERE assignee_id = ? AND status IN ('todo', 'in_progress') ORDER BY priority ASC"
    ).all(agentId) as Record<string, unknown>[];

    return NextResponse.json({
      received: true,
      timestamp: now,
      pendingTasks: pendingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
    });
  } catch (error) {
    console.error('POST /api/heartbeat error:', error);
    return NextResponse.json(
      { error: 'Failed to process heartbeat' },
      { status: 500 }
    );
  }
}
