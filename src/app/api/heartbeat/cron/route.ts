import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { getHeartbeatSchedule, getAgentStatus } from '@/lib/heartbeatCron';
import { v4 as uuid } from 'uuid';
import { consumeNotifications } from '@/lib/notifications';

export async function POST() {
  try {
    const db = getDb();
    const schedule = getHeartbeatSchedule();
    const results: Array<{ agentId: string; agentName: string; status: string; unreadCount: number }> = [];

    // Process agents with staggered delays (fire-and-forget for delayed ones)
    async function processAgent(entry: typeof schedule[0]) {
      const status = getAgentStatus(entry.agentId);

      const res = await fetch('http://localhost:3003/api/heartbeat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: entry.agentId, status }),
      });
      const data = await res.json();
      const unreadMessages = data.unreadMessages || [];

      for (const msg of unreadMessages) {
        if (msg.toAgentId === entry.agentId) {
          const ackId = uuid();
          await db.run(
            `INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
            [ackId, entry.agentId, msg.fromAgentId, `📬 Acknowledged: "${msg.content.substring(0, 80)}${msg.content.length > 80 ? '...' : ''}"`, 'system']
          );
        }
      }

      // Deliver pending notifications
      const notifications = await consumeNotifications(entry.agentId);
      for (const notif of notifications) {
        const notifMsgId = uuid();
        await db.run(
          `INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
          [notifMsgId, notif.sourceAgentId || 'system', entry.agentId, `🔔 ${notif.content}`, 'notification']
        );
      }

      return {
        agentId: entry.agentId,
        agentName: entry.agentName,
        status,
        unreadCount: unreadMessages.length,
        notificationsDelivered: notifications.length,
        offsetMinutes: entry.offsetMinutes,
      };
    }

    // First agent runs immediately, rest are staggered
    const firstResult = await processAgent(schedule[0]);
    results.push(firstResult);

    // Stagger remaining agents (fire-and-forget with delays)
    for (let i = 1; i < schedule.length; i++) {
      const entry = schedule[i];
      const delayMs = entry.offsetMinutes * 60 * 1000;
      setTimeout(async () => {
        try {
          await processAgent(entry);
        } catch (e) {
          console.error(`[Heartbeat] ${entry.agentName} staggered beat failed:`, e);
        }
      }, delayMs);
      results.push({ agentId: entry.agentId, agentName: entry.agentName, status: 'scheduled', unreadCount: 0, notificationsDelivered: 0, delayMs } as any);
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
