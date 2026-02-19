import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    const rows = await db.all(`
      SELECT m.*,
        a.name AS from_agent_name,
        a.avatar AS from_agent_avatar
      FROM messages m
      LEFT JOIN agents a ON m.from_agent_id = a.id
      ORDER BY m.created_at DESC
      LIMIT $1
    `, [limit]) as Record<string, unknown>[];

    const messages = rows.map((row) => ({
      id: row.id,
      fromAgentId: row.from_agent_id,
      fromAgentName: row.from_agent_name ?? null,
      fromAgentAvatar: row.from_agent_avatar ?? null,
      toAgentId: row.to_agent_id,
      content: row.content,
      type: row.type,
      createdAt: row.created_at,
      read: !!row.read, // Convert to boolean
    }));

    return NextResponse.json(messages);
  } catch (error) {
    console.error('GET /api/messages error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const {
      fromAgentId,
      toAgentId = null,
      content,
      type = 'message',
    } = body;

    if (!fromAgentId || !content) {
      return NextResponse.json(
        { error: 'fromAgentId and content are required' },
        { status: 400 }
      );
    }

    const id = uuid();
    const now = new Date().toISOString();

    await db.run(
      `INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [id, fromAgentId, toAgentId, content, type, now]
    );

    const row = await db.get(`
      SELECT m.*, a.name AS from_agent_name, a.avatar AS from_agent_avatar
      FROM messages m
      LEFT JOIN agents a ON m.from_agent_id = a.id
      WHERE m.id = $1
    `, [id]) as Record<string, unknown>;

    return NextResponse.json(
      {
        id: row.id,
        fromAgentId: row.from_agent_id,
        fromAgentName: row.from_agent_name ?? null,
        fromAgentAvatar: row.from_agent_avatar ?? null,
        toAgentId: row.to_agent_id,
        content: row.content,
        type: row.type,
        createdAt: row.created_at,
        read: !!row.read, // Convert to boolean
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/messages error:', error);
    return NextResponse.json(
      { error: 'Failed to create message' },
      { status: 500 }
    );
  }
}