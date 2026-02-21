import { getDb } from './db';

export const LOOP_LIMITS = {
  maxTodoPerAgent: Number(process.env.LOOP_MAX_TODO_PER_AGENT || 2),
  maxReviewPerContentCategory: Number(process.env.LOOP_MAX_REVIEW_PER_CONTENT_CATEGORY || 3),
  stagingBlockThresholdPerCategory: Number(process.env.LOOP_STAGING_BLOCK_THRESHOLD || 6),
};

export type ContentCategory = 'courses' | 'licks' | 'blog_social' | 'other';

export function inferContentCategory(title: string, tags: string[] = []): ContentCategory {
  const text = `${title} ${tags.join(' ')}`.toLowerCase();
  if (/lick|tab|riff|solo/.test(text)) return 'licks';
  if (/course|lesson|curriculum|module/.test(text)) return 'courses';
  if (/blog|seo|social|instagram|twitter|x\b|tiktok|caption|email|marketing/.test(text)) return 'blog_social';
  return 'other';
}

export async function getAgentTodoCount(assigneeId: string): Promise<number> {
  const db = getDb();
  const row = await db.get(`SELECT COUNT(*) as c FROM tasks WHERE assignee_id = $1 AND status = 'todo'`, [assigneeId]) as { c: number };
  return row?.c || 0;
}

export async function findDuplicateTask(title: string, assigneeId?: string | null): Promise<{ id: string; status: string } | null> {
  const db = getDb();
  const normTitle = title.trim().toLowerCase();

  // strict duplicate in recent window
  const strict = await db.get(
    `SELECT id, status FROM tasks
     WHERE LOWER(TRIM(title)) = $1
       AND created_at > NOW() - INTERVAL '14 days'
     ORDER BY created_at DESC LIMIT 1`,
    [normTitle]
  ) as { id: string; status: string } | undefined;
  if (strict) return strict;

  // same assignee + similar prefix in active queue
  if (assigneeId) {
    const similar = await db.get(
      `SELECT id, status FROM tasks
       WHERE assignee_id = $1
         AND status IN ('backlog','todo','in_progress','review')
         AND LOWER(title) LIKE $2
       ORDER BY created_at DESC LIMIT 1`,
      [assigneeId, `%${normTitle.slice(0, Math.min(normTitle.length, 32))}%`]
    ) as { id: string; status: string } | undefined;
    if (similar) return similar;
  }

  return null;
}

export async function getStagingBacklogByCategory() {
  const db = getDb();
  const rows = await db.all(
    `SELECT stage, title, platform FROM content_pipeline WHERE stage IN ('idea','writing','review','assets','scheduled')`,
    []
  ) as Array<{ stage: string; title: string; platform: string | null }>;

  const out = { courses: 0, licks: 0, blog_social: 0, other: 0 } as Record<ContentCategory, number>;
  for (const r of rows) {
    const cat = inferContentCategory(r.title || '', [r.platform || '']);
    out[cat] = (out[cat] || 0) + 1;
  }
  return out;
}

export async function shouldGateCategory(category: ContentCategory): Promise<boolean> {
  if (category === 'other') return false;
  const backlog = await getStagingBacklogByCategory();
  return (backlog[category] || 0) >= LOOP_LIMITS.stagingBlockThresholdPerCategory;
}

export async function getLoopHealthMetrics() {
  const db = getDb();

  const cycle = await db.get(
    `SELECT COALESCE(AVG(duration_ms),0) as avg_cycle_ms FROM task_results WHERE status = 'completed' AND created_at > NOW() - INTERVAL '7 days'`,
    []
  ) as { avg_cycle_ms: number };

  const reviewWait = await db.get(
    `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (completed_at - updated_at)) * 1000),0) as avg_review_wait_ms
     FROM tasks WHERE status = 'done' AND completed_at IS NOT NULL AND updated_at IS NOT NULL AND completed_at > NOW() - INTERVAL '7 days'`,
    []
  ) as { avg_review_wait_ms: number };

  const approvals = await db.get(
    `SELECT
       COUNT(*) FILTER (WHERE action = 'approve') as approved,
       COUNT(*) FILTER (WHERE action = 'revise') as revised
     FROM (
       SELECT CASE
         WHEN message LIKE 'Task approve:%' THEN 'approve'
         WHEN message LIKE 'Task revise:%' THEN 'revise'
         ELSE 'other'
       END as action
       FROM activity_log
       WHERE type = 'review' AND created_at > NOW() - INTERVAL '7 days'
     ) x`,
    []
  ) as { approved: number; revised: number };

  const dupes = await db.get(
    `SELECT COUNT(*) as c FROM activity_log WHERE type = 'system' AND message LIKE '%Dedup blocked%' AND created_at > NOW() - INTERVAL '7 days'`,
    []
  ) as { c: number };

  const createdCompleted = await db.all(
    `SELECT DATE(created_at) as day,
      COUNT(*) as created,
      SUM(CASE WHEN status = 'done' THEN 1 ELSE 0 END) as completed
     FROM tasks
     WHERE created_at > NOW() - INTERVAL '7 days'
     GROUP BY DATE(created_at)
     ORDER BY day ASC`,
    []
  ) as Array<{ day: string; created: number; completed: number }>;

  const totalReviewed = (approvals.approved || 0) + (approvals.revised || 0);

  return {
    avgCycleMs: Math.round(cycle.avg_cycle_ms || 0),
    avgReviewWaitMs: Math.round(reviewWait.avg_review_wait_ms || 0),
    autoApprovedPct: totalReviewed ? Math.round(((approvals.approved || 0) / totalReviewed) * 100) : 0,
    humanRevisedPct: totalReviewed ? Math.round(((approvals.revised || 0) / totalReviewed) * 100) : 0,
    duplicateTaskRate: dupes.c || 0,
    tasksCreatedVsCompletedByDay: createdCompleted,
  };
}
