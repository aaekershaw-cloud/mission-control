import { getDb } from './db';

/**
 * Auto-start the queue if there are todo tasks waiting.
 * Safe to call multiple times — only starts if not already running.
 */
export async function triggerQueueIfNeeded() {
  const db = getDb();
  const state = await db.get(`SELECT * FROM queue_state WHERE id = 'singleton'`) as Record<string, unknown> | null;
  
  if (state?.status === 'running') return; // already running

  const todoCount = await db.get(`SELECT COUNT(*) as c FROM tasks WHERE status = 'todo'`) as { c: number };
  if (todoCount.c === 0) return; // nothing to process

  // Start the queue by importing and calling the queue processor
  // We do this via an internal fetch to avoid circular deps
  fetch('http://localhost:3003/api/queue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'start' }),
  }).catch(() => {});
}