import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const row = db.prepare('SELECT * FROM squads WHERE id = ?').get(id) as Record<string, unknown> | undefined;

    if (!row) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Get full agent details for this squad
    const agents = db.prepare(
      'SELECT * FROM agents WHERE squad_id = ? ORDER BY created_at ASC'
    ).all(id) as Record<string, unknown>[];

    const agentList = agents.map((a) => ({
      id: a.id,
      name: a.name,
      codename: a.codename,
      avatar: a.avatar,
      role: a.role,
      status: a.status,
      lastHeartbeat: a.last_heartbeat,
      tasksCompleted: a.tasks_completed,
      tokensUsed: a.tokens_used,
      costUsd: a.cost_usd,
      currentTaskId: a.current_task_id,
    }));

    return NextResponse.json({
      id: row.id,
      name: row.name,
      description: row.description,
      leadAgentId: row.lead_agent_id,
      agentIds: JSON.parse((row.agent_ids as string) || '[]'),
      createdAt: row.created_at,
      status: row.status,
      agents: agentList,
    });
  } catch (error) {
    console.error('GET /api/squads/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch squad' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;
    const body = await request.json();

    const existing = db.prepare('SELECT id FROM squads WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    const allowedFields: Record<string, string> = {
      name: 'name',
      description: 'description',
      leadAgentId: 'lead_agent_id',
      status: 'status',
    };

    const setClauses: string[] = [];
    const values: unknown[] = [];

    for (const [camel, snake] of Object.entries(allowedFields)) {
      if (camel in body) {
        setClauses.push(`${snake} = ?`);
        values.push(body[camel]);
      }
    }

    if ('agentIds' in body) {
      setClauses.push('agent_ids = ?');
      values.push(JSON.stringify(body.agentIds));

      // Remove new agents from their previous squads' agent_ids lists
      if (body.agentIds.length > 0) {
        const placeholders = body.agentIds.map(() => '?').join(',');
        const previousSquads = db.prepare(
          `SELECT DISTINCT squad_id FROM agents WHERE squad_id IS NOT NULL AND squad_id != ? AND id IN (${placeholders})`
        ).all(id, ...body.agentIds) as Array<{ squad_id: string }>;

        for (const { squad_id: oldSquadId } of previousSquads) {
          const oldSquad = db.prepare('SELECT agent_ids FROM squads WHERE id = ?').get(oldSquadId) as { agent_ids: string } | undefined;
          if (oldSquad) {
            const oldList: string[] = JSON.parse(oldSquad.agent_ids || '[]');
            const updated = oldList.filter((aid: string) => !body.agentIds.includes(aid));
            db.prepare('UPDATE squads SET agent_ids = ? WHERE id = ?').run(JSON.stringify(updated), oldSquadId);
          }
        }
      }

      // Update agents' squad_id: clear old, set new
      db.prepare('UPDATE agents SET squad_id = NULL, updated_at = datetime(\'now\') WHERE squad_id = ?').run(id);
      if (body.agentIds.length > 0) {
        const placeholders = body.agentIds.map(() => '?').join(',');
        db.prepare(
          `UPDATE agents SET squad_id = ?, updated_at = datetime('now') WHERE id IN (${placeholders})`
        ).run(id, ...body.agentIds);
      }
    }

    if (setClauses.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      );
    }

    values.push(id);

    db.prepare(
      `UPDATE squads SET ${setClauses.join(', ')} WHERE id = ?`
    ).run(...values);

    const row = db.prepare('SELECT * FROM squads WHERE id = ?').get(id) as Record<string, unknown>;

    return NextResponse.json({
      id: row.id,
      name: row.name,
      description: row.description,
      leadAgentId: row.lead_agent_id,
      agentIds: JSON.parse((row.agent_ids as string) || '[]'),
      createdAt: row.created_at,
      status: row.status,
    });
  } catch (error) {
    console.error('PUT /api/squads/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to update squad' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const db = getDb();
    const { id } = await params;

    const existing = db.prepare('SELECT id FROM squads WHERE id = ?').get(id);
    if (!existing) {
      return NextResponse.json({ error: 'Squad not found' }, { status: 404 });
    }

    // Clear squad_id from agents
    db.prepare('UPDATE agents SET squad_id = NULL, updated_at = datetime(\'now\') WHERE squad_id = ?').run(id);

    // Mark as disbanded and clear agent_ids list
    db.prepare("UPDATE squads SET status = 'disbanded', agent_ids = '[]', lead_agent_id = NULL WHERE id = ?").run(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/squads/[id] error:', error);
    return NextResponse.json(
      { error: 'Failed to disband squad' },
      { status: 500 }
    );
  }
}
