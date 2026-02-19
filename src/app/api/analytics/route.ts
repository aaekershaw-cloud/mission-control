import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { TaskStatus } from '@/types';

export async function GET() {
  try {
    const db = getDb();

    // Total and active agents
    const agentStats = db.prepare(`
      SELECT
        COUNT(*) AS total_agents,
        SUM(CASE WHEN status IN ('online', 'busy') THEN 1 ELSE 0 END) AS active_agents,
        SUM(tokens_used) AS total_tokens,
        SUM(cost_usd) AS total_cost
      FROM agents
    `).get() as Record<string, number>;

    // Task totals
    const taskStats = db.prepare(`
      SELECT
        COUNT(*) AS total_tasks,
        SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) AS completed_tasks
      FROM tasks
    `).get() as Record<string, number>;

    // Tasks by status
    const statusRows = db.prepare(`
      SELECT status, COUNT(*) AS count FROM tasks GROUP BY status
    `).all() as Array<{ status: TaskStatus; count: number }>;

    const tasksByStatus: Record<TaskStatus, number> = {
      backlog: 0, todo: 0, in_progress: 0, review: 0, done: 0,
    };
    for (const row of statusRows) {
      tasksByStatus[row.status] = row.count;
    }

    // Agent performance with avg duration from task_results
    const agentPerf = db.prepare(`
      SELECT a.id, a.name, a.codename, a.avatar, a.tasks_completed, a.tokens_used, a.cost_usd,
        COALESCE(AVG(tr.duration_ms), 0) as avg_duration_ms,
        COUNT(CASE WHEN tr.status = 'completed' THEN 1 END) as successful_results,
        COUNT(CASE WHEN tr.status = 'error' THEN 1 END) as error_results
      FROM agents a
      LEFT JOIN task_results tr ON a.id = tr.agent_id
      GROUP BY a.id
      ORDER BY a.tasks_completed DESC
    `).all() as Record<string, unknown>[];

    const agentPerformance = agentPerf.map((a) => ({
      agentId: a.id as string,
      name: a.name as string,
      codename: a.codename as string,
      avatar: a.avatar as string,
      tasksCompleted: a.tasks_completed as number,
      tokensUsed: a.tokens_used as number,
      costUsd: a.cost_usd as number,
      avgDurationMs: Math.round(a.avg_duration_ms as number),
      successfulResults: a.successful_results as number,
      errorResults: a.error_results as number,
    }));

    // Cost by day (last 7 days)
    const costByDay = db.prepare(`
      SELECT DATE(created_at) as day, SUM(cost_usd) as cost, SUM(tokens_used) as tokens, COUNT(*) as tasks
      FROM task_results
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `).all() as Array<{ day: string; cost: number; tokens: number; tasks: number }>;

    // Queue history (tasks processed over time)
    const queueHistory = db.prepare(`
      SELECT DATE(created_at) as day, COUNT(*) as count,
        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed,
        SUM(CASE WHEN status = 'error' THEN 1 ELSE 0 END) as errors
      FROM task_results
      GROUP BY DATE(created_at)
      ORDER BY day ASC
    `).all() as Array<{ day: string; count: number; completed: number; errors: number }>;

    // Activity timeline (last 24 hours)
    const timelineRows = db.prepare(`
      SELECT strftime('%Y-%m-%dT%H:00:00', created_at) AS hour, 'task' AS source
      FROM tasks WHERE created_at >= datetime('now', '-24 hours')
      UNION ALL
      SELECT strftime('%Y-%m-%dT%H:00:00', created_at) AS hour, 'message' AS source
      FROM messages WHERE created_at >= datetime('now', '-24 hours')
    `).all() as Array<{ hour: string; source: string }>;

    const timelineMap = new Map<string, { tasks: number; messages: number }>();
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setUTCMinutes(0, 0, 0);
      d.setUTCHours(d.getUTCHours() - i);
      const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}T${String(d.getUTCHours()).padStart(2, '0')}:00:00`;
      timelineMap.set(key, { tasks: 0, messages: 0 });
    }
    for (const row of timelineRows) {
      const entry = timelineMap.get(row.hour);
      if (entry) {
        if (row.source === 'task') entry.tasks++;
        else entry.messages++;
      }
    }
    const activityTimeline = Array.from(timelineMap.entries()).map(([hour, data]) => ({
      hour, tasks: data.tasks, messages: data.messages,
    }));

    // Recent completions
    const recentCompletions = db.prepare(`
      SELECT tr.id, tr.task_id, t.title as task_title, a.name as agent_name, a.avatar as agent_avatar,
             tr.tokens_used, tr.cost_usd, tr.duration_ms, tr.status, tr.created_at
      FROM task_results tr
      LEFT JOIN tasks t ON tr.task_id = t.id
      LEFT JOIN agents a ON tr.agent_id = a.id
      ORDER BY tr.created_at DESC
      LIMIT 20
    `).all() as Record<string, unknown>[];

    return NextResponse.json({
      totalAgents: agentStats.total_agents ?? 0,
      activeAgents: agentStats.active_agents ?? 0,
      totalTasks: taskStats.total_tasks ?? 0,
      completedTasks: taskStats.completed_tasks ?? 0,
      totalTokens: agentStats.total_tokens ?? 0,
      totalCost: agentStats.total_cost ?? 0,
      tasksByStatus,
      agentPerformance,
      activityTimeline,
      costByDay,
      queueHistory,
      recentCompletions: recentCompletions.map((r) => ({
        id: r.id,
        taskId: r.task_id,
        taskTitle: r.task_title,
        agentName: r.agent_name,
        agentAvatar: r.agent_avatar,
        tokensUsed: r.tokens_used,
        costUsd: r.cost_usd,
        durationMs: r.duration_ms,
        status: r.status,
        createdAt: r.created_at,
      })),
    });
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
