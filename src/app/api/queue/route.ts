import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { executeTask } from '@/lib/executor';
import { autoAssignTask } from '@/lib/autoAssign';

// In-memory queue flag (module-level singleton — works in dev mode)
let queueRunning = false;
let shouldStop = false;

async function getQueueState() {
  const db = getDb();
  return await db.get('SELECT * FROM queue_state WHERE id = $1', ['singleton']) as {
    id: string;
    status: string;
    current_task_id: string | null;
    tasks_processed: number;
    tasks_remaining: number;
    started_at: string | null;
    updated_at: string;
  } | null;
}

async function updateQueueState(fields: {
  status?: string;
  current_task_id?: string | null;
  tasks_processed?: number;
  tasks_remaining?: number;
  started_at?: string | null;
}) {
  const db = getDb();
  const setClauses: string[] = ["updated_at = NOW()"];
  const values: unknown[] = [];
  let paramIndex = 1;

  if ('status' in fields) { setClauses.push(`status = $${paramIndex}`); values.push(fields.status); paramIndex++; }
  if ('current_task_id' in fields) { setClauses.push(`current_task_id = $${paramIndex}`); values.push(fields.current_task_id); paramIndex++; }
  if ('tasks_processed' in fields) { setClauses.push(`tasks_processed = $${paramIndex}`); values.push(fields.tasks_processed); paramIndex++; }
  if ('tasks_remaining' in fields) { setClauses.push(`tasks_remaining = $${paramIndex}`); values.push(fields.tasks_remaining); paramIndex++; }
  if ('started_at' in fields) { setClauses.push(`started_at = $${paramIndex}`); values.push(fields.started_at); paramIndex++; }

  values.push('singleton');
  await db.run(`UPDATE queue_state SET ${setClauses.join(', ')} WHERE id = $${paramIndex}`, values);
}

async function processQueue() {
  const db = getDb();

  while (!shouldStop) {
    // Priority order: critical=0, high=1, medium=2, low=3
    const tasks = await db.all(`
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
    `) as Array<{
      id: string; title: string; assignee_id: string | null;
      tags: string | any[]; description: string; priority: string;
    }>;

    // Filter: try to auto-assign unassigned ones first
    const eligible: Array<{ id: string; title: string }> = [];

    for (const task of tasks) {
      if (task.assignee_id) {
        eligible.push(task);
      } else {
        // Try auto-assign
        const tags = Array.isArray(task.tags) ? task.tags : JSON.parse(task.tags || '[]') as string[];
        const assigned = await autoAssignTask(task.id, tags, task.description || '');
        if (assigned) {
          eligible.push(task);
        }
      }
    }

    if (eligible.length === 0) break;

    const next = eligible[0];

    await updateQueueState({
      current_task_id: next.id,
      tasks_remaining: eligible.length - 1,
    });

    try {
      await executeTask(next.id);
    } catch (err) {
      console.error(`Queue: error executing task ${next.id}:`, err);
    }

    // Increment processed count
    const state = await getQueueState();
    await updateQueueState({
      current_task_id: null,
      tasks_processed: (state?.tasks_processed ?? 0) + 1,
    });

    if (shouldStop) break;
  }

  // Done
  queueRunning = false;
  shouldStop = false;
  await updateQueueState({
    status: 'idle',
    current_task_id: null,
    tasks_remaining: 0,
    started_at: null,
  });
}

// --- Route Handlers ---

export async function GET() {
  const state = await getQueueState();
  if (!state) {
    return NextResponse.json({ status: 'idle', tasksProcessed: 0, tasksRemaining: 0 });
  }

  // If state says running but in-memory flag disagrees, sync
  const effectiveStatus = queueRunning ? 'running' : 'idle';

  // Get count of todo/in_progress tasks
  const db = getDb();
  const remaining = await db.get(
    `SELECT COUNT(*) as c FROM tasks WHERE status = 'todo'`
  ) as { c: number };
  const inProgress = await db.get(
    `SELECT COUNT(*) as c FROM tasks WHERE status = 'in_progress'`
  ) as { c: number };

  // Auto-escalation: if idle >10m and no active work, trigger Producer refill (cooldown 30m)
  if (effectiveStatus === 'idle' && remaining.c === 0 && inProgress.c === 0) {
    const idleForMs = Date.now() - new Date(state.updated_at).getTime();
    if (idleForMs > 10 * 60 * 1000) {
      const recentEscalation = await db.get(
        `SELECT COUNT(*) as c FROM tasks
         WHERE title LIKE '[Auto] Generate task batch%' AND created_at > NOW() - INTERVAL '30 minutes'`,
        []
      ) as { c: number };

      if ((recentEscalation.c || 0) === 0) {
        fetch('http://localhost:3003/api/produce/auto', { method: 'POST' }).catch(() => {});
        // System notification message
        const { v4: uuid } = await import('uuid');
        await db.run(
          `INSERT INTO messages (id, from_agent_id, content, type, created_at) VALUES ($1, $2, $3, 'system', NOW())`,
          [uuid(), 'system', '⚠️ Queue idle >10m with no active work. Triggered Producer emergency refill.']
        );
      }
    }
  }

  return NextResponse.json({
    status: effectiveStatus,
    currentTaskId: state.current_task_id,
    tasksProcessed: state.tasks_processed,
    tasksRemaining: remaining.c,
    startedAt: state.started_at,
    updatedAt: state.updated_at,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const action = body.action as string;

  if (action === 'stop') {
    shouldStop = true;
    await updateQueueState({ status: 'stopping' });
    return NextResponse.json({ ok: true, message: 'Queue will stop after current task.' });
  }

  if (action === 'start') {
    if (queueRunning) {
      const state = await getQueueState();
      return NextResponse.json({
        ok: false,
        message: 'Queue is already running.',
        status: state,
      });
    }

    const db = getDb();

    // Count eligible tasks
    const todoTasks = await db.get(
      `SELECT COUNT(*) as c FROM tasks WHERE status = 'todo'`
    ) as { c: number };

    if (todoTasks.c === 0) {
      return NextResponse.json({
        ok: false,
        message: 'No todo tasks found. Add tasks with status "todo" and an assigned agent.',
      });
    }

    queueRunning = true;
    shouldStop = false;
    await updateQueueState({
      status: 'running',
      tasks_remaining: todoTasks.c,
      started_at: new Date().toISOString(),
    });

    // Start processing in background (non-blocking)
    processQueue().catch(async (err) => {
      console.error('Queue processor error:', err);
      queueRunning = false;
      await updateQueueState({ status: 'idle', current_task_id: null });
    });

    return NextResponse.json({
      ok: true,
      message: `Queue started. ${todoTasks.c} todo task(s) found.`,
      tasksQueued: todoTasks.c,
    });
  }

  return NextResponse.json({ error: 'Unknown action. Use action: "start" or "stop".' }, { status: 400 });
}