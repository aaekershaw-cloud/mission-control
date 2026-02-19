import { getDb } from '@/lib/db';

export interface AgentSchedule {
  agentId: string;
  agentName: string;
  offsetMinutes: number;
  intervalMinutes: number;
}

export function getHeartbeatSchedule(): AgentSchedule[] {
  const db = getDb();
  const agents = db.prepare(
    "SELECT id, name FROM agents WHERE id != 'system' ORDER BY created_at ASC"
  ).all() as Array<{ id: string; name: string }>;

  return agents.map((agent, index) => ({
    agentId: agent.id,
    agentName: agent.name,
    offsetMinutes: index * 2,
    intervalMinutes: 15,
  }));
}

export function getAgentStatus(agentId: string): 'active' | 'idle' {
  const db = getDb();
  const active = db.prepare(
    "SELECT COUNT(*) as c FROM tasks WHERE assignee_id = ? AND status = 'in_progress'"
  ).get(agentId) as { c: number };
  return active.c > 0 ? 'active' : 'idle';
}
