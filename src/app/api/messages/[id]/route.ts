import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const existing = await db.get('SELECT id FROM messages WHERE id = $1', [id]);
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if ('read' in body) {
      await db.run('UPDATE messages SET read = $1 WHERE id = $2', [body.read, id]);
    }

    const row = await db.get(`
      SELECT m.*, a.name AS from_agent_name, a.avatar AS from_agent_avatar
      FROM messages m
      LEFT JOIN agents a ON m.from_agent_id = a.id
      WHERE m.id = $1
    `, [id]) as Record<string, unknown>;

    return NextResponse.json({
      id: row.id,
      fromAgentId: row.from_agent_id,
      fromAgentName: row.from_agent_name ?? null,
      fromAgentAvatar: row.from_agent_avatar ?? null,
      toAgentId: row.to_agent_id,
      content: row.content,
      type: row.type,
      createdAt: row.created_at,
      read: row.read as boolean,
    });
  } catch (error) {
    console.error('PATCH /api/messages/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}
