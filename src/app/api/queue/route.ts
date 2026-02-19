import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { executeTask } from '@/lib/executor';
import { autoAssignTask } from '@/lib/autoAssign';

// In-memory queue flag (module-level singleton — works in dev mode)
let queueRunning = false;
let shouldStop = false;

function getQueueState() {
  const db = getDb();
  return db.prepare('SELECT * FROM queue_state WHERE id = ?').get('singleton') as {
    id: string;
    status: string;
    current_task_id: string | null;
    tasks_processed: number;
    tasks_remaining: number;
    started_at: string | null;
    updated_at: string;
  } | undefined;
}

function updateQueueState(fields: {
  status?: string;
  current_task_id?: string | null;
  tasks_processed?: number;
  tasks_remaining?: number;
  started_at?: string | null;
}) {
  const db = getDb();
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const values: unknown[] = [];

  if ('status' in fields) { setClauses.push('status = ?'); values.push(fields.status); }
  if ('current_task_id' in fields) { setClauses.push('current_task_id = ?'); values.push(fields.current_task_id); }
  if ('tasks_processed' in fields) { setClauses.push('tasks_processed = ?'); values.push(fields.tasks_processed); }
  if ('tasks_remaining' in fields) { setClauses.push('tasks_remaining = ?'); values.push(fields.tasks_remaining); }
  if ('started_at' in fields) { setClauses.push('started_at = ?'); values.push(fields.started_at); }

  values.push('singleton');
  db.prepare(`UPDATE queue_state SET ${setClauses.join(', ')} WHERE id = ?`).run(...values);
}

async function processQueue() {
  const db = getDb();

  while (!shouldStop) {
    // Priority order: critical=0, high=1, medium=2, low=3
    const tasks = db.prepare(`
      SELECT t.*, a.id as agent_id
      FROM tasks t
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.status = 'todo'
      ORDER BY
        CASE t.priority
          WHEN 'critical' THEN 0
          WHEN 'high'     THEN 1
          WHEN 'medium'   THEN 2
          WHEN 'low'      THEN 3
          ELSE 4
        END,
        t.created_at ASC
    `).all() as Array<{
      id: string; title: string; assignee_id: string | null;
      tags: string; description: string; priority: string;
    }>;

    // Filter: try to auto-assign unassigned ones first
    const eligible: Array<{ id: string; title: string }> = [];

    for (const task of tasks) {
      if (task.assignee_id) {
        eligible.push(task);
      } else {
        // Try auto-assign
        const tags = JSON.parse(task.tags || '[]') as string[];
        const assigned = await autoAssignTask(task.id, tags, task.description || '');
        if (assigned) {
          eligible.push(task);
        }
      }
    }

    if (eligible.length === 0) break;

    const next = eligible[0];

    updateQueueState({
      current_task_id: next.id,
      tasks_remaining: eligible.length - 1,
    });

    try {
      await executeTask(next.id);
    } catch (err) {
      console.error(`Queue: error executing task ${next.id}:`, err);
    }

    // Increment processed count
    const state = getQueueState();
    updateQueueState({
      current_task_id: null,
      tasks_processed: (state?.tasks_processed ?? 0) + 1,
    });

    if (shouldStop) break;
  }

  // Done
  queueRunning = false;
  shouldStop = false;
  updateQueueState({
    status: 'idle',
    current_task_id: null,
    tasks_remaining: 0,
    started_at: null,
  });
}

// --- Route Handlers ---

export async function GET() {
  const state = getQueueState();
  if (!state) {
    return NextResponse.json({ status: 'idle', tasksProcessed: 0, tasksRemaining: 0 });
  }

  // If state says running but in-memory flag disagrees, sync
  const effectiveStatus = queueRunning ? 'running' : 'idle';

  // Get count of todo tasks with assignees
  const db = getDb();
  const remaining = (db.prepare(
    `SELECT COUNT(*) as c FROM tasks WHERE status = 'todo'`
  ).get() as { c: number }).c;

  return NextResponse.json({
    status: effectiveStatus,
    currentTaskId: state.current_task_id,
    tasksProcessed: state.tasks_processed,
    tasksRemaining: remaining,
    startedAt: state.started_at,
    updatedAt: state.updated_at,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === 'stop') {
    shouldStop = true;
    updateQueueState({ status: 'stopping' });
    return NextResponse.json({ ok: true, message: 'Queue will stop after current task.' });
  }

  if (action === 'start') {
    if (queueRunning) {
      const state = getQueueState();
      return NextResponse.json({
        ok: false,
        message: 'Queue is already running.',
        status: state,
      });
    }

    const db = getDb();

    // Count eligible tasks
    const todoTasks = db.prepare(
      `SELECT COUNT(*) as c FROM tasks WHERE status = 'todo'`
    ).get() as { c: number };

    if (todoTasks.c === 0) {
      return NextResponse.json({
        ok: false,
        message: 'No todo tasks found. Add tasks with status "todo" and an assigned agent.',
      });
    }

    queueRunning = true;
    shouldStop = false;
    updateQueueState({
      status: 'running',
      tasks_remaining: todoTasks.c,
      started_at: new Date().toISOString(),
    });

    // Start processing in background (non-blocking)
    processQueue().catch((err) => {
      console.error('Queue processor error:', err);
      queueRunning = false;
      updateQueueState({ status: 'idle', current_task_id: null });
    });

    return NextResponse.json({
      ok: true,
      message: `Queue started. ${todoTasks.c} todo task(s) found.`,
      tasksQueued: todoTasks.c,
    });
  }

  return NextResponse.json({ error: 'Unknown action. Use action: "start" or "stop".' }, { status: 400 });
}
