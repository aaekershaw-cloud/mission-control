import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getAgentStatus } from '@/lib/heartbeatCron';

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const { agentIndex } = await request.json();

    if (typeof agentIndex !== 'number') {
      return NextResponse.json({ error: 'agentIndex (number) is required' }, { status: 400 });
    }

    const agents = await db.all(
      "SELECT id, name FROM agents WHERE id != $1 ORDER BY created_at ASC",
      ['system']
    ) as Array<{ id: string; name: string }>;

    if (agentIndex < 0 || agentIndex >= agents.length) {
      return NextResponse.json({ error: `agentIndex out of range (0-${agents.length - 1})` }, { status: 400 });
    }

    const agent = agents[agentIndex];
    const status = getAgentStatus(agent.id);

    const res = await fetch('http://localhost:3003/api/heartbeat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: agent.id, status }),
    });
    const data = await res.json();

    return NextResponse.json({
      ok: true,
      agentId: agent.id,
      agentName: agent.name,
      status,
      heartbeatResponse: data,
    });
  } catch (error) {
    console.error('POST /api/heartbeat/trigger error:', error);
    return NextResponse.json({ error: 'Trigger failed' }, { status: 500 });
  }
}
