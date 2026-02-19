import { getDb } from './db';
import { v4 as uuid } from 'uuid';

export async function logActivity(
  eventType: string,  // 'agent_task' | 'content' | 'social' | 'stripe' | 'review' | 'system' | 'deploy'
  title: string,
  description: string = '',
  agentId: string | null = null,
  metadata: Record<string, any> = {}
) {
  const db = getDb();
  await db.run(
    'INSERT INTO activity_log (id, event_type, title, description, agent_id, metadata) VALUES ($1, $2, $3, $4, $5, $6)',
    [uuid(), eventType, title, description, agentId, JSON.stringify(metadata)]
  );
}