import { getDb } from '@/lib/db';

export interface AgentSchedule {
  agentId: string;
  agentName: string;
  offsetMinutes: number;
  intervalMinutes: number;
}

export async function getHeartbeatSchedule(): Promise<AgentSchedule[]> {
  const db = getDb();
  const agents = await db.all(
    "SELECT id, name FROM agents WHERE id != 'system' ORDER BY created_at ASC"
  ) as Array<{ id: string; name: string }>;

  return agents.map((agent, index) => ({
    agentId: agent.id,
    agentName: agent.name,
    offsetMinutes: index * 2,
    intervalMinutes: 15,
  }));
}

export async function getAgentStatus(agentId: string): Promise<'active' | 'idle'> {
  const db = getDb();
  const active = await db.get(
    "SELECT COUNT(*) as c FROM tasks WHERE assignee_id = $1 AND status = 'in_progress'",
    [agentId]
  ) as { c: number };
  return active.c > 0 ? 'active' : 'idle';
}
