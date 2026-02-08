import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import type { TaskStatus, AnalyticsData } from '@/types';

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
      backlog: 0,
      todo: 0,
      in_progress: 0,
      review: 0,
      done: 0,
    };
    for (const row of statusRows) {
      tasksByStatus[row.status] = row.count;
    }

    // Agent performance
    const agentPerf = db.prepare(`
      SELECT id, name, codename, avatar, tasks_completed, tokens_used, cost_usd
      FROM agents
      ORDER BY tasks_completed DESC
    `).all() as Record<string, unknown>[];

    const agentPerformance = agentPerf.map((a) => ({
      agentId: a.id as string,
      name: a.name as string,
      codename: a.codename as string,
      avatar: a.avatar as string,
      tasksCompleted: a.tasks_completed as number,
      tokensUsed: a.tokens_used as number,
      costUsd: a.cost_usd as number,
    }));

    // Activity timeline (last 24 hours, grouped by hour)
    const timelineRows = db.prepare(`
      SELECT
        strftime('%Y-%m-%dT%H:00:00', created_at) AS hour,
        'task' AS source
      FROM tasks
      WHERE created_at >= datetime('now', '-24 hours')
      UNION ALL
      SELECT
        strftime('%Y-%m-%dT%H:00:00', created_at) AS hour,
        'message' AS source
      FROM messages
      WHERE created_at >= datetime('now', '-24 hours')
    `).all() as Array<{ hour: string; source: string }>;

    const timelineMap = new Map<string, { tasks: number; messages: number }>();

    // Initialize all 24 hours
    for (let i = 23; i >= 0; i--) {
      const d = new Date();
      d.setMinutes(0, 0, 0);
      d.setHours(d.getHours() - i);
      const key = d.toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00:00');
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
      hour,
      tasks: data.tasks,
      messages: data.messages,
    }));

    const analytics: AnalyticsData = {
      totalAgents: agentStats.total_agents ?? 0,
      activeAgents: agentStats.active_agents ?? 0,
      totalTasks: taskStats.total_tasks ?? 0,
      completedTasks: taskStats.completed_tasks ?? 0,
      totalTokens: agentStats.total_tokens ?? 0,
      totalCost: agentStats.total_cost ?? 0,
      tasksByStatus,
      agentPerformance,
      activityTimeline,
    };

    return NextResponse.json(analytics);
  } catch (error) {
    console.error('GET /api/analytics error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
