import { getDb } from './db';
import { v4 as uuid } from 'uuid';

/**
 * Create a notification for an agent (delivered on their next heartbeat)
 */
export async function notifyAgent(agentId: string, content: string, taskId?: string, sourceAgentId?: string) {
  const db = getDb();
  await db.run(
    `INSERT INTO notifications (id, agent_id, task_id, content, source_agent_id, delivered, created_at) VALUES ($1, $2, $3, $4, $5, FALSE, NOW())`,
    [uuid(), agentId, taskId || null, content, sourceAgentId || null]
  );
}

/**
 * Get undelivered notifications for an agent and mark them delivered
 */
export async function consumeNotifications(agentId: string): Promise<{ content: string; taskId: string | null; sourceAgentId: string | null }[]> {
  const db = getDb();
  const notifications = await db.all(
    `SELECT id, content, task_id, source_agent_id FROM notifications WHERE agent_id = $1 AND delivered = FALSE ORDER BY created_at ASC`,
    [agentId]
  ) as Array<{ id: string; content: string; task_id: string | null; source_agent_id: string | null }>;

  if (notifications.length > 0) {
    const ids = notifications.map(n => n.id);
    // Mark all as delivered
    await db.run(
      `UPDATE notifications SET delivered = TRUE WHERE id = ANY($1::text[])`,
      [`{${ids.join(',')}}`]
    );
  }

  return notifications.map(n => ({ content: n.content, taskId: n.task_id, sourceAgentId: n.source_agent_id }));
}

/**
 * Subscribe an agent to a task thread
 */
export async function subscribeToTask(agentId: string, taskId: string) {
  const db = getDb();
  try {
    await db.run(
      `INSERT INTO task_subscriptions (id, agent_id, task_id, created_at) VALUES ($1, $2, $3, NOW()) ON CONFLICT (agent_id, task_id) DO NOTHING`,
      [uuid(), agentId, taskId]
    );
  } catch {
    // Ignore duplicate
  }
}

/**
 * Get all agents subscribed to a task
 */
export async function getTaskSubscribers(taskId: string): Promise<string[]> {
  const db = getDb();
  const subs = await db.all(
    `SELECT agent_id FROM task_subscriptions WHERE task_id = $1`,
    [taskId]
  ) as Array<{ agent_id: string }>;
  return subs.map(s => s.agent_id);
}

/**
 * Notify all subscribers of a task (except the source agent)
 */
export async function notifyTaskSubscribers(taskId: string, content: string, sourceAgentId: string) {
  const subscribers = await getTaskSubscribers(taskId);
  for (const agentId of subscribers) {
    if (agentId !== sourceAgentId) {
      await notifyAgent(agentId, content, taskId, sourceAgentId);
    }
  }
}

/**
 * Parse @mentions from text and notify mentioned agents
 */
export async function processAtMentions(text: string, taskId: string | null, sourceAgentId: string) {
  const db = getDb();
  
  // Match @AgentName or @CODENAME
  const mentionPattern = /@(\w+)/g;
  const mentions = [...text.matchAll(mentionPattern)].map(m => m[1]);
  
  if (mentions.length === 0) return;

  // Handle @all
  if (mentions.some(m => m.toLowerCase() === 'all')) {
    const allAgents = await db.all(`SELECT id FROM agents WHERE id != $1 AND codename != 'SYSTEM'`, [sourceAgentId]) as Array<{ id: string }>;
    for (const agent of allAgents) {
      await notifyAgent(agent.id, text, taskId || undefined, sourceAgentId);
    }
    return;
  }

  // Match by name or codename
  for (const mention of mentions) {
    const agent = await db.get(
      `SELECT id FROM agents WHERE UPPER(codename) = $1 OR LOWER(name) = $2`,
      [mention.toUpperCase(), mention.toLowerCase()]
    ) as { id: string } | undefined;

    if (agent && agent.id !== sourceAgentId) {
      await notifyAgent(agent.id, text, taskId || undefined, sourceAgentId);
    }
  }
}

/**
 * Update an agent's working memory (current task state)
 */
export async function updateWorkingMemory(agentId: string, memory: string) {
  const db = getDb();
  await db.run(`UPDATE agents SET working_memory = $1, updated_at = NOW() WHERE id = $2`, [memory, agentId]);
}

/**
 * Get an agent's working memory
 */
export async function getWorkingMemory(agentId: string): Promise<string> {
  const db = getDb();
  const agent = await db.get(`SELECT working_memory FROM agents WHERE id = $1`, [agentId]) as { working_memory: string } | undefined;
  return agent?.working_memory || '';
}
