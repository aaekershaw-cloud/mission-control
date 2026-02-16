import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const db = getDb();

    const rows = db.prepare(`
      SELECT s.*,
        (SELECT COUNT(*) FROM agents a WHERE a.squad_id = s.id) AS agent_count
      FROM squads s
      ORDER BY s.created_at ASC
    `).all() as Record<string, unknown>[];

    const squads = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      leadAgentId: row.lead_agent_id,
      agentIds: JSON.parse((row.agent_ids as string) || '[]'),
      createdAt: row.created_at,
      status: row.status,
      agentCount: row.agent_count,
    }));

    return NextResponse.json(squads);
  } catch (error) {
    console.error('GET /api/squads error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squads' },
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
      description = '',
      leadAgentId = null,
      agentIds = [],
    } = body;

    if (!name) {
      return NextResponse.json(
        { error: 'name is required' },
        { status: 400 }
      );
    }

    const id = uuid();
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO squads (id, name, description, lead_agent_id, agent_ids, created_at, status)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`
    ).run(id, name, description, leadAgentId, JSON.stringify(agentIds), now);

    // Update agents' squad_id and remove them from their previous squads' agent_ids
    if (agentIds.length > 0) {
      // Find which squads these agents currently belong to
      const placeholders = agentIds.map(() => '?').join(',');
      const previousSquads = db.prepare(
        `SELECT DISTINCT squad_id FROM agents WHERE squad_id IS NOT NULL AND id IN (${placeholders})`
      ).all(...agentIds) as Array<{ squad_id: string }>;

      // Remove these agents from their old squads' agent_ids lists
      for (const { squad_id: oldSquadId } of previousSquads) {
        const oldSquad = db.prepare('SELECT agent_ids FROM squads WHERE id = ?').get(oldSquadId) as { agent_ids: string } | undefined;
        if (oldSquad) {
          const oldList: string[] = JSON.parse(oldSquad.agent_ids || '[]');
          const updated = oldList.filter((aid: string) => !agentIds.includes(aid));
          db.prepare('UPDATE squads SET agent_ids = ? WHERE id = ?').run(JSON.stringify(updated), oldSquadId);
        }
      }

      // Assign agents to the new squad
      db.prepare(
        `UPDATE agents SET squad_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
      ).run(id, ...agentIds);
    }

    const row = db.prepare('SELECT * FROM squads WHERE id = ?').get(id) as Record<string, unknown>;

    return NextResponse.json(
      {
        id: row.id,
        name: row.name,
        description: row.description,
        leadAgentId: row.lead_agent_id,
        agentIds: JSON.parse((row.agent_ids as string) || '[]'),
        createdAt: row.created_at,
        status: row.status,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('POST /api/squads error:', error);
    return NextResponse.json(
      { error: 'Failed to create squad' },
      { status: 500 }
    );
  }
}
