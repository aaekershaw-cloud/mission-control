import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '100', 10);

    const rows = await db.all(`
      SELECT h.*, a.name AS agent_name, a.avatar AS agent_avatar, a.codename AS agent_codename
      FROM heartbeats h
      LEFT JOIN agents a ON h.agent_id = a.id
      ORDER BY h.timestamp DESC
      LIMIT $1
    `, [limit]) as Record<string, unknown>[];

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
    const agent = await db.get('SELECT id FROM agents WHERE id = $1', [agentId]);
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }

    const now = new Date().toISOString();

    // Insert heartbeat record
    await db.run(
      `INSERT INTO heartbeats (agent_id, status, timestamp, task_progress, memory_usage, tokens_used_session)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [agentId, status, now, taskProgress, memoryUsage, tokensUsedSession]
    );

    // Update agent's last_heartbeat and status
    await db.run(
      "UPDATE agents SET last_heartbeat = $1, status = $2, updated_at = NOW() WHERE id = $3",
      [now, status, agentId]
    );

    // Fetch pending tasks assigned to this agent
    const pendingTasks = await db.all(
      "SELECT id, title, status, priority FROM tasks WHERE assignee_id = $1 AND status IN ('todo', 'in_progress') ORDER BY priority ASC",
      [agentId]
    ) as Record<string, unknown>[];

    // Fetch unread messages for this agent
    const unreadMessages = await db.all(`
      SELECT m.*, a.name AS from_agent_name, a.avatar AS from_agent_avatar
      FROM messages m
      LEFT JOIN agents a ON m.from_agent_id = a.id
      WHERE (m.to_agent_id = $1 OR m.to_agent_id IS NULL) AND m.read = false
      ORDER BY m.created_at DESC LIMIT 10
    `, [agentId]) as Record<string, unknown>[];

    // Mark them as read
    await db.run(
      `UPDATE messages SET read = true WHERE (to_agent_id = $1 OR to_agent_id IS NULL) AND read = false`,
      [agentId]
    );

    return NextResponse.json({
      received: true,
      timestamp: now,
      pendingTasks: pendingTasks.map((t) => ({
        id: t.id,
        title: t.title,
        status: t.status,
        priority: t.priority,
      })),
      unreadMessages: unreadMessages.map((m) => ({
        id: m.id,
        fromAgentId: m.from_agent_id,
        fromAgentName: m.from_agent_name ?? null,
        fromAgentAvatar: m.from_agent_avatar ?? null,
        toAgentId: m.to_agent_id,
        content: m.content,
        type: m.type,
        createdAt: m.created_at,
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
