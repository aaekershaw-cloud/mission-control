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

    const existing = db.prepare('SELECT id FROM messages WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 });
    }

    if ('read' in body) {
      db.prepare('UPDATE messages SET read = ? WHERE id = ?').run(body.read ? 1 : 0, id);
    }

    const row = db.prepare(`
      SELECT m.*, a.name AS from_agent_name, a.avatar AS from_agent_avatar
      FROM messages m
      LEFT JOIN agents a ON m.from_agent_id = a.id
      WHERE m.id = ?
    `).get(id) as Record<string, unknown>;

    return NextResponse.json({
      id: row.id,
      fromAgentId: row.from_agent_id,
      fromAgentName: row.from_agent_name ?? null,
      fromAgentAvatar: row.from_agent_avatar ?? null,
      toAgentId: row.to_agent_id,
      content: row.content,
      type: row.type,
      createdAt: row.created_at,
      read: row.read === 1,
    });
  } catch (error) {
    console.error('PATCH /api/messages/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update message' },
      { status: 500 }
    );
  }
}
