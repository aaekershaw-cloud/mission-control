import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { triggerQueueIfNeeded } from '@/lib/autoQueue';
import { v4 as uuid } from 'uuid';

/**
 * POST /api/produce
 * Takes the Producer agent's task output and bulk-creates tasks.
 * Can be called after Producer task completes (via chain or manually).
 * 
 * Body: { taskId: string } — the Producer's completed task ID to parse results from
 * OR: { tasks: [...] } — direct array of task objects
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();

  let tasks: Array<Record<string, unknown>>;

  if (body.taskId) {
    // Parse from a completed Producer task result
    const result = db.prepare(`
      SELECT tr.response FROM task_results tr
      WHERE tr.task_id = ? AND tr.status = 'completed'
      ORDER BY tr.created_at DESC LIMIT 1
    `).get(body.taskId) as { response: string } | undefined;

    if (!result) {
      return NextResponse.json({ error: 'No completed result found for task' }, { status: 404 });
    }

    // Extract JSON from response (may be in code fence)
    let raw = result.response.trim();
    if (raw.startsWith('```json')) {
      raw = raw.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
    } else if (raw.startsWith('```')) {
      raw = raw.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
    }

    try {
      // Try jsonrepair for robustness
      const { jsonrepair } = require('jsonrepair');
      tasks = JSON.parse(jsonrepair(raw));
    } catch {
      try {
        tasks = JSON.parse(raw);
      } catch {
        return NextResponse.json({ error: 'Failed to parse Producer output as JSON' }, { status: 400 });
      }
    }
  } else if (body.tasks && Array.isArray(body.tasks)) {
    tasks = body.tasks;
  } else {
    return NextResponse.json({ error: 'Provide taskId or tasks array' }, { status: 400 });
  }

  if (!Array.isArray(tasks)) {
    return NextResponse.json({ error: 'Expected array of tasks' }, { status: 400 });
  }

  // Resolve agent codenames to IDs
  const agents = db.prepare('SELECT id, codename FROM agents').all() as Array<{ id: string; codename: string }>;
  const agentMap = new Map(agents.map(a => [a.codename.toUpperCase(), a.id]));

  // Resolve depends_on_title to task IDs
  const allTasks = db.prepare('SELECT id, title FROM tasks').all() as Array<{ id: string; title: string }>;
  const titleToId = new Map(allTasks.map(t => [t.title.toLowerCase(), t.id]));

  const created: string[] = [];
  const newTitleToId = new Map<string, string>();

  for (const t of tasks) {
    const id = uuid();
    const title = (t.title as string) || 'Untitled Task';
    const description = (t.description as string) || '';
    const priority = (t.priority as string) || 'medium';
    const agentCodename = ((t.agent as string) || '').toUpperCase();
    const assigneeId = agentMap.get(agentCodename) || null;
    const tags = JSON.stringify(Array.isArray(t.tags) ? t.tags : []);

    // Resolve dependency
    let dependsOn = '';
    if (t.depends_on_title) {
      const depTitle = (t.depends_on_title as string).toLowerCase();
      const depId = titleToId.get(depTitle) || newTitleToId.get(depTitle);
      if (depId) dependsOn = depId;
    }

    const status = dependsOn ? 'backlog' : 'todo';

    db.prepare(`
      INSERT INTO tasks (id, title, description, status, priority, assignee_id, tags, depends_on, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(id, title, description, status, priority, assigneeId, tags, dependsOn);

    newTitleToId.set(title.toLowerCase(), id);
    created.push(id);
  }

  // Auto-start queue for new todo tasks
  triggerQueueIfNeeded();

  return NextResponse.json({
    ok: true,
    created: created.length,
    taskIds: created,
  });
}
