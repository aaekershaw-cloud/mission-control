import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CONTENT_DIR = '/Users/andrewkershaw/.openclaw/workspace/projects/fretboard-mastery/landing-page/content';
const REPO_DIR = '/Users/andrewkershaw/.openclaw/workspace/projects/fretboard-mastery/landing-page';

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function tryParseJson(response: string): unknown {
  let raw = response.trim();
  if (raw.startsWith('```json')) raw = raw.replace(/^```json\s*\n?/, '').replace(/\n?```\s*$/, '');
  else if (raw.startsWith('```')) raw = raw.replace(/^```\w*\s*\n?/, '').replace(/\n?```\s*$/, '');
  try {
    const { jsonrepair } = require('jsonrepair');
    return JSON.parse(jsonrepair(raw));
  } catch {
    try { return JSON.parse(raw); } catch { return null; }
  }
}

function categorizeContent(task: Record<string, unknown>, parsed: unknown): string {
  const title = ((task.title as string) || '').toLowerCase();
  const tags = (() => { try { return JSON.parse((task.tags as string) || '[]'); } catch { return []; } })() as string[];

  if (tags.includes('licks') || tags.includes('tabs') || title.includes('lick')) return 'licks';
  if (tags.includes('course') || tags.includes('curriculum') || title.includes('course')) return 'courses';
  if (tags.includes('blog') || title.includes('blog')) return 'blog';
  if (title.includes('lesson') || title.includes('onboarding')) return 'lessons';
  if (title.includes('practice') || title.includes('routine')) return 'lessons';

  // Detect from content structure
  if (parsed && typeof parsed === 'object') {
    if (Array.isArray(parsed)) {
      const first = (parsed as Record<string, unknown>[])[0];
      if (first?.lick_name || first?.tab_notation) return 'licks';
      if (first?.lessonNumber || first?.lessonTitle) return 'lessons';
    } else {
      const obj = parsed as Record<string, unknown>;
      if (obj.courseTitle || obj.lessons) return 'courses';
      if (obj.lick_name) return 'licks';
    }
  }

  return 'other';
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);
}

/**
 * POST /api/export
 * Export approved task content to the landing page content directory.
 * Body: { taskId: string } — exports a single approved task
 * Body: { all: true } — exports all approved tasks with results
 */
export async function POST(req: NextRequest) {
  const db = getDb();
  const body = await req.json();

  let tasks: Array<Record<string, unknown>>;

  if (body.taskId) {
    const task = await db.get(`
      SELECT t.*, tr.response, a.name as agent_name
      FROM tasks t
      JOIN task_results tr ON tr.task_id = t.id AND tr.status = 'completed'
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.id = $1 AND t.status = 'done'
      ORDER BY tr.created_at DESC
    `, [body.taskId]) as Record<string, unknown> | undefined;
    tasks = task ? [task] : [];
  } else if (body.all) {
    tasks = (await db.all(`
      SELECT t.*, tr.response, a.name as agent_name,
        ROW_NUMBER() OVER (PARTITION BY t.id ORDER BY tr.created_at DESC) as rn
      FROM tasks t
      JOIN task_results tr ON tr.task_id = t.id AND tr.status = 'completed'
      LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.status = 'done' AND tr.response IS NOT NULL
    `, [])).filter((r) => (r as { rn: number }).rn === 1) as Array<Record<string, unknown>>;
  } else {
    return NextResponse.json({ error: 'Provide taskId or all:true' }, { status: 400 });
  }

  const exported: Array<{ taskId: string; category: string; file: string }> = [];
  const skipped: string[] = [];

  for (const task of tasks) {
    const response = task.response as string;
    if (!response) { skipped.push(task.id as string); continue; }

    const parsed = tryParseJson(response);
    const category = categorizeContent(task, parsed);

    if (category === 'other') { skipped.push(task.id as string); continue; }

    const dir = path.join(CONTENT_DIR, category);
    ensureDir(dir);

    const slug = slugify(task.title as string);
    const filename = `${slug}.json`;
    const filepath = path.join(dir, filename);

    const exportData = {
      _meta: {
        taskId: task.id,
        taskTitle: task.title,
        agent: task.agent_name,
        exportedAt: new Date().toISOString(),
        category,
      },
      content: parsed || response,
    };

    fs.writeFileSync(filepath, JSON.stringify(exportData, null, 2));
    exported.push({ taskId: task.id as string, category, file: filename });
  }

  // Auto git commit if anything was exported
  if (exported.length > 0 && body.autoCommit !== false) {
    try {
      execSync('git add content/', { cwd: REPO_DIR, stdio: 'pipe' });
      const msg = `content: export ${exported.length} item(s) — ${exported.map(e => e.category).filter((v, i, a) => a.indexOf(v) === i).join(', ')}`;
      execSync(`git commit -m "${msg}" --allow-empty`, { cwd: REPO_DIR, stdio: 'pipe' });
      execSync('git push origin main', { cwd: REPO_DIR, stdio: 'pipe' });
    } catch (err) {
      console.error('[Export] Git error:', err);
    }
  }

  return NextResponse.json({
    ok: true,
    exported: exported.length,
    skipped: skipped.length,
    files: exported,
  });
}
