import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getHeartbeatSchedule, getAgentStatus } from '@/lib/heartbeatCron';
import { v4 as uuid } from 'uuid';

export async function POST() {
  try {
    const db = getDb();
    const schedule = getHeartbeatSchedule();
    const results: Array<{ agentId: string; agentName: string; status: string; unreadCount: number }> = [];

    for (const entry of schedule) {
      const status = getAgentStatus(entry.agentId);

      // Send heartbeat
      const res = await fetch('http://localhost:3003/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: entry.agentId, status }),
      });
      const data = await res.json();
      const unreadMessages = data.unreadMessages || [];

      // Auto-acknowledge directed messages
      for (const msg of unreadMessages) {
        if (msg.toAgentId === entry.agentId) {
          const ackId = uuid();
          const now = new Date().toISOString();
          await db.run(
            `INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
            [ackId, entry.agentId, msg.fromAgentId, `📬 Acknowledged: "${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}"`, 'system', now]
          );
        }
      }

      results.push({
        agentId: entry.agentId,
        agentName: entry.agentName,
        status,
        unreadCount: unreadMessages.length,
      });
    }

    return NextResponse.json({ ok: true, agents: results });
  } catch (error) {
    console.error('POST /api/heartbeat/cron error:', error);
    return NextResponse.json({ error: 'Heartbeat cron failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const schedule = getHeartbeatSchedule();
    return NextResponse.json({
      intervalMinutes: 15,
      staggerMinutes: 2,
      agents: schedule,
    });
  } catch (error) {
    console.error('GET /api/heartbeat/cron error:', error);
    return NextResponse.json({ error: 'Failed to get schedule' }, { status: 500 });
  }
}
