import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

/**
 * GET /api/standup — Generate daily standup summary
 */
export async function GET(_req: NextRequest) {
  const db = getDb();

  // Tasks completed today
  const completed = await db.all(`
    SELECT t.title, a.name as agent_name, a.avatar as agent_avatar
    FROM tasks t LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.status = 'done' AND t.completed_at > NOW() - INTERVAL '24 hours'
    ORDER BY t.completed_at DESC
  `) as Array<{ title: string; agent_name: string; agent_avatar: string }>;

  // Tasks in progress
  const inProgress = await db.all(`
    SELECT t.title, a.name as agent_name, a.avatar as agent_avatar
    FROM tasks t LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.status = 'in_progress'
    ORDER BY t.updated_at DESC
  `) as Array<{ title: string; agent_name: string; agent_avatar: string }>;

  // Tasks in review
  const inReview = await db.all(`
    SELECT t.title, a.name as agent_name, a.avatar as agent_avatar
    FROM tasks t LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.status = 'review'
    ORDER BY t.updated_at DESC
  `) as Array<{ title: string; agent_name: string; agent_avatar: string }>;

  // Tasks blocked (todo but older than 24h with no progress)
  const backlog = await db.all(`
    SELECT t.title, a.name as agent_name
    FROM tasks t LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.status IN ('todo', 'backlog')
    ORDER BY t.created_at ASC
    LIMIT 10
  `) as Array<{ title: string; agent_name: string }>;

  // Agent status
  const agents = await db.all(`
    SELECT name, avatar, level, status, working_memory,
      (SELECT COUNT(*) FROM tasks WHERE assignee_id = agents.id AND status = 'done' AND completed_at > NOW() - INTERVAL '24 hours') as tasks_today
    FROM agents
    WHERE codename NOT IN ('SYSTEM', 'CEO')
    ORDER BY level, name
  `) as Array<{ name: string; avatar: string; level: string; status: string; working_memory: string; tasks_today: number }>;

  // Content pipeline stats
  const pipeline = await db.all(`
    SELECT stage, COUNT(*) as count FROM content_pipeline GROUP BY stage
  `) as Array<{ stage: string; count: number }>;

  // Cost today
  const costToday = await db.get(`
    SELECT COALESCE(SUM(cost_usd), 0) as total FROM task_results WHERE created_at > NOW() - INTERVAL '24 hours'
  `) as { total: number };

  // Format the standup
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Pacific/Honolulu' });

  let report = `📊 DAILY STANDUP — ${date}\n\n`;

  // Completed
  report += `✅ COMPLETED TODAY (${completed.length})\n`;
  if (completed.length === 0) report += '  (none)\n';
  for (const t of completed.slice(0, 15)) {
    report += `  ${t.agent_avatar || '🤖'} ${t.agent_name}: ${t.title}\n`;
  }
  if (completed.length > 15) report += `  ...and ${completed.length - 15} more\n`;

  // In Progress
  report += `\n🔄 IN PROGRESS (${inProgress.length})\n`;
  if (inProgress.length === 0) report += '  (none)\n';
  for (const t of inProgress) {
    report += `  ${t.agent_avatar || '🤖'} ${t.agent_name}: ${t.title}\n`;
  }

  // Needs Review
  report += `\n👀 NEEDS REVIEW (${inReview.length})\n`;
  if (inReview.length === 0) report += '  (none)\n';
  for (const t of inReview) {
    report += `  ${t.agent_avatar || '🤖'} ${t.agent_name}: ${t.title}\n`;
  }

  // Backlog
  if (backlog.length > 0) {
    report += `\n📋 BACKLOG (${backlog.length})\n`;
    for (const t of backlog.slice(0, 5)) {
      report += `  → ${t.title}${t.agent_name ? ` (${t.agent_name})` : ''}\n`;
    }
    if (backlog.length > 5) report += `  ...and ${backlog.length - 5} more\n`;
  }

  // Agent roster
  report += `\n🤖 AGENT ROSTER\n`;
  for (const a of agents) {
    const levelBadge = a.level === 'lead' ? '⭐' : a.level === 'intern' ? '🔰' : '🔧';
    report += `  ${a.avatar || '🤖'} ${a.name} ${levelBadge} — ${a.tasks_today} tasks today`;
    if (a.working_memory) {
      const firstLine = a.working_memory.split('\n').find(l => l.startsWith('**'))?.replace(/\*\*/g, '') || '';
      if (firstLine) report += ` | ${firstLine}`;
    }
    report += '\n';
  }

  // Pipeline
  const pipelineMap = Object.fromEntries(pipeline.map(p => [p.stage, p.count]));
  report += `\n📱 SOCIAL PIPELINE: ${pipelineMap['review'] || 0} review · ${pipelineMap['scheduled'] || 0} scheduled · ${pipelineMap['published'] || 0} published\n`;

  // Cost
  report += `\n💰 COST TODAY: $${(costToday.total || 0).toFixed(4)}\n`;

  // Level legend
  report += `\n📐 LEVELS: ⭐ Lead (full autonomy) · 🔧 Specialist (domain autonomy) · 🔰 Intern (needs approval)\n`;

  return NextResponse.json({ report, stats: { completed: completed.length, inProgress: inProgress.length, inReview: inReview.length, backlog: backlog.length, costToday: costToday.total } });
}
