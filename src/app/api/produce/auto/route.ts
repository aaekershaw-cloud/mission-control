import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { triggerQueueIfNeeded } from '@/lib/autoQueue';
import { v4 as uuid } from 'uuid';

/**
 * POST /api/produce/auto
 * Auto-generates a Producer task with current project state context.
 * Called by cron or manually to kick off a new task generation cycle.
 */
export async function POST() {
  const db = getDb();

  // Get Producer agent
  const producer = await db.get("SELECT id FROM agents WHERE codename = 'PRODUCER'", []) as { id: string } | undefined;
  if (!producer) {
    return NextResponse.json({ error: 'Producer agent not found' }, { status: 404 });
  }

  // Check if Producer already has a pending/in-progress task
  const activeTask = await db.get(`
    SELECT id, status FROM tasks WHERE assignee_id = $1 AND status IN ('todo', 'in_progress')
  `, [producer.id]) as { id: string; status: string } | undefined;
  if (activeTask) {
    return NextResponse.json({ skipped: true, reason: 'Producer already has an active task', taskId: activeTask.id });
  }

  // Gather current state
  const statusCounts = await db.all(`
    SELECT status, COUNT(*) as count FROM tasks GROUP BY status
  `, []) as Array<{ status: string; count: number }>;

  const recentCompleted = await db.all(`
    SELECT t.title, a.name as agent_name, t.completed_at
    FROM tasks t LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.status = 'done' AND t.completed_at IS NOT NULL
    ORDER BY t.completed_at DESC LIMIT 15
  `, []) as Array<{ title: string; agent_name: string; completed_at: string }>;

  const recentReview = await db.all(`
    SELECT t.title, a.name as agent_name FROM tasks t
    LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.status = 'review'
  `, []) as Array<{ title: string; agent_name: string }>;

  const agentWorkload = await db.all(`
    SELECT a.name, a.codename,
      (SELECT COUNT(*) FROM tasks WHERE assignee_id = a.id AND status = 'todo') as todo_count,
      (SELECT COUNT(*) FROM tasks WHERE assignee_id = a.id AND status = 'done') as done_count
    FROM agents a WHERE a.codename NOT IN ('CEO', 'PRODUCER')
    ORDER BY a.name
  `, []) as Array<{ name: string; codename: string; todo_count: number; done_count: number }>;

  const statusSummary = statusCounts.map(s => `${s.status}: ${s.count}`).join(', ');
  const recentWork = recentCompleted.map(t => `- ✅ "${t.title}" (${t.agent_name})`).join('\n');
  const inReview = recentReview.map(t => `- 🔍 "${t.title}" (${t.agent_name})`).join('\n');
  const workload = agentWorkload.map(a => `- ${a.name} (${a.codename}): ${a.todo_count} queued, ${a.done_count} completed`).join('\n');

  const description = `You are generating the next batch of tasks for the FretCoach.ai agent fleet.

## CURRENT PROJECT STATE
Task counts: ${statusSummary}

### Recently Completed Work
${recentWork || '(none)'}

### Currently In Review
${inReview || '(none)'}

### Agent Workload
${workload}

## BUSINESS PLAN CONTEXT
FretCoach.ai is an AI-powered guitar learning platform. Key phases:
- Phase 0 (Foundation): COMPLETE — landing page, lead magnets, email funnel, Mission Control, all agents active
- Phase 1 (Content Engine): IN PROGRESS — need 250+ licks, courses, theory content, SEO blog posts, social content
- Phase 2 (Platform Build): UPCOMING — web app, auth, subscription, practice room
- Phase 3 (Launch): UPCOMING — email sequences, Product Hunt, ads

## YOUR TASK
Analyze the current state and generate 10-15 NEW tasks that:
1. Fill gaps in content (licks, courses, theory, blog posts)
2. Don't duplicate recently completed or in-review work
3. Balance workload across agents (prioritize underutilized agents)
4. Push the project toward Phase 1 completion
5. Include some marketing/growth tasks alongside content tasks

Focus areas this cycle:
- Lick library expansion (target: 250+ total)
- Course content development
- SEO blog posts for organic traffic
- Social media content pipeline
- Email nurture sequence content`;

  // Create the task
  const taskId = uuid();
  await db.run(`
    INSERT INTO tasks (id, title, description, status, priority, assignee_id, tags, created_at, updated_at)
    VALUES ($1, $2, $3, 'todo', 'high', $4, '["meta","planning","auto-produce"]', NOW(), NOW())
  `, [taskId, `[Auto] Generate task batch — ${new Date().toISOString().split('T')[0]}`, description, producer.id]);

  triggerQueueIfNeeded();

  return NextResponse.json({ ok: true, taskId, message: 'Producer task created and queued' });
}
