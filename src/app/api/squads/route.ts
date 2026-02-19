import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const db = getDb();

    const rows = await db.all(`
      SELECT s.*,
        (SELECT COUNT(*) FROM agents a WHERE a.squad_id = s.id) AS agent_count
      FROM squads s
      ORDER BY s.created_at ASC
    `) as Record<string, unknown>[];

    const squads = rows.map((row) => ({
      id: row.id,
      name: row.name,
      description: row.description,
      leadAgentId: row.lead_agent_id,
      agentIds: row.agent_ids || [], // JSONB - already parsed
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

    await db.run(
      `INSERT INTO squads (id, name, description, lead_agent_id, agent_ids, created_at, status)
       VALUES ($1, $2, $3, $4, $5, NOW(), 'active')`,
      [id, name, description, leadAgentId, JSON.stringify(agentIds)]
    );

    // Update agents' squad_id and remove them from their previous squads' agent_ids
    if (agentIds.length > 0) {
      // Find which squads these agents currently belong to
      const placeholders = agentIds.map((_, index) => `$${index + 1}`).join(',');
      const previousSquads = await db.all(
        `SELECT DISTINCT squad_id FROM agents WHERE squad_id IS NOT NULL AND id IN (${placeholders})`,
        agentIds
      ) as Array<{ squad_id: string }>;

      // Remove these agents from their old squads' agent_ids lists
      for (const { squad_id: oldSquadId } of previousSquads) {
        const oldSquad = await db.get('SELECT agent_ids FROM squads WHERE id = $1', [oldSquadId]) as { agent_ids: any } | undefined;
        if (oldSquad) {
          const oldList: string[] = oldSquad.agent_ids || []; // JSONB - already parsed
          const updated = oldList.filter((aid: string) => !agentIds.includes(aid));
          await db.run('UPDATE squads SET agent_ids = $1 WHERE id = $2', [JSON.stringify(updated), oldSquadId]);
        }
      }

      // Assign agents to the new squad
      await db.run(
        `UPDATE agents SET squad_id = $1, updated_at = NOW() WHERE id IN (${placeholders})`,
        [id, ...agentIds]
      );
    }

    const row = await db.get('SELECT * FROM squads WHERE id = $1', [id]) as Record<string, unknown>;

    return NextResponse.json(
      {
        id: row.id,
        name: row.name,
        description: row.description,
        leadAgentId: row.lead_agent_id,
        agentIds: row.agent_ids || [], // JSONB - already parsed
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
