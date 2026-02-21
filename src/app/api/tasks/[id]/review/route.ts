import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { triggerQueueIfNeeded } from '@/lib/autoQueue';
import { unlockDependentTasks, checkAndRefillQueue } from '@/lib/executor';
import { v4 as uuid } from 'uuid';
import { logActivity } from '@/lib/activityLog';
import { processAtMentions, subscribeToTask, notifyTaskSubscribers } from '@/lib/notifications';

const SYSTEM_AGENT_ID = 'system';

async function postCommsMessage(fromAgentId: string, content: string, type: string, toAgentId: string | null = null) {
  const db = getDb();
  const id = uuid();
  const now = new Date().toISOString();
  await db.run(
    `INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, fromAgentId, toAgentId, content, type, now]
  );
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const db = getDb();

  const task = await db.get(`
    SELECT t.*, a.name as agent_name, a.avatar as agent_avatar, a.codename as agent_codename
    FROM tasks t
    LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.id = $1
  `, [taskId]) as Record<string, unknown> | undefined;

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  const latestResult = await db.get(`
    SELECT tr.*, a.name as agent_name, a.avatar as agent_avatar
    FROM task_results tr
    LEFT JOIN agents a ON tr.agent_id = a.id
    WHERE tr.task_id = $1 AND tr.status = 'completed'
    ORDER BY tr.created_at DESC LIMIT 1
  `, [taskId]) as Record<string, unknown> | undefined;

  // Get latest auto-review result if one exists
  const autoReview = await db.get(`
    SELECT * FROM auto_reviews 
    WHERE task_id = $1
    ORDER BY created_at DESC 
    LIMIT 1
  `, [taskId]) as Record<string, unknown> | undefined;

  let parsedAutoReview = null;
  if (autoReview) {
    parsedAutoReview = {
      ...autoReview,
      reasons: JSON.parse(autoReview.reasons as string),
      checks: JSON.parse(autoReview.checks as string)
    };
  }

  return NextResponse.json({ 
    task, 
    result: latestResult || null, 
    autoReview: parsedAutoReview 
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const db = getDb();
  const body = await req.json();
  const { action, feedback } = body as { action: string; feedback?: string };

  const task = await db.get(`
    SELECT t.*, a.name as agent_name, a.avatar as agent_avatar, a.codename as agent_codename
    FROM tasks t
    LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.id = $1
  `, [taskId]) as Record<string, string> | undefined;

  if (!task) {
    return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  }

  if (action === 'approve') {
    await db.run(`
      UPDATE tasks SET status = 'done', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [taskId]);

    // Unlock any chained/dependent tasks waiting on this one
    unlockDependentTasks(taskId);
    triggerQueueIfNeeded();

    // Log review activity
    await logActivity('review', `Task approve: ${task.title}`, feedback || '', null, { 
      taskId: task.id, 
      action: 'approve', 
      taggedAgents: [] 
    });

    // Post approval comms message
    let approveContent = `✅ Task approved: **${task.title}**. Great work!`;
    // Check for dependent tasks that got unlocked
    const dependentTasks = await db.all(`
      SELECT t.id, t.title, t.assignee_id, a.name as assignee_name
      FROM tasks t LEFT JOIN agents a ON t.assignee_id = a.id
      WHERE t.depends_on LIKE $1
    `, [`%${taskId}%`]) as Array<{ id: string; title: string; assignee_id: string | null; assignee_name: string | null }>;
    for (const dep of dependentTasks) {
      if (dep.assignee_name) {
        approveContent += `\n@${dep.assignee_name} — your task **${dep.title}** is now unblocked and ready to go.`;
      }
    }
    await postCommsMessage(task.assignee_id || SYSTEM_AGENT_ID, approveContent, 'system');

    // Route QA gate to @Qualtrol before any staging export
    const taskResult = await db.get('SELECT response FROM task_results WHERE task_id = $1', [taskId]);
    const taskContent = taskResult?.response || task.description || '';

    // Determine content category from tags
    const taskTags: string[] = (() => {
      try {
        const raw = task.tags;
        if (Array.isArray(raw)) return raw;
        if (typeof raw === 'string') return JSON.parse(raw);
        return [];
      } catch { return []; }
    })();
    const category = taskTags.includes('lick') || taskTags.includes('licks') ? 'licks'
      : taskTags.includes('course') || taskTags.includes('lesson') ? 'courses'
      : taskTags.includes('blog') ? 'blog' : 'courses';

    const qualtrol = await db.get(`SELECT id, name FROM agents WHERE UPPER(codename) = 'QUALTROL' LIMIT 1`) as { id: string; name: string } | undefined;
    if (qualtrol?.id) {
      const qaTaskId = uuid();
      const qaTitle = `QA Gate: ${task.title}`;
      const qaDesc = `Review approved content before staging export.\n\nOriginal task: ${taskId}\nCategory: ${category}\nAuthor: ${task.agent_name || task.assignee_name || 'unknown'}\n\nChecklist:\n- grammar/spelling\n- factual correctness\n- JSON/content structure\n- formatting/tab notation\n\nWhen approved, trigger export for original taskId ${taskId}.\n\nContent:\n${String(taskContent).slice(0, 8000)}`;

      await db.run(
        `INSERT INTO tasks (id, title, description, status, priority, assignee_id, tags, chain_context, created_at, updated_at)
         VALUES ($1, $2, $3, 'todo', 'high', $4, $5, $6, NOW(), NOW())`,
        [qaTaskId, qaTitle, qaDesc, qualtrol.id, JSON.stringify(['qa', 'qualtrol-review', 'pre-staging', category]), JSON.stringify({ sourceTaskId: taskId, category, action: 'pre_staging_qc' })]
      );

      await postCommsMessage(SYSTEM_AGENT_ID, `@${qualtrol.name} QA gate created for **${task.title}** (source task: ${taskId}).`, 'system', qualtrol.id);
      await logActivity('review', `Queued @Qualtrol QA gate for ${task.title}`, `Source task ${taskId}`, qualtrol.id, { sourceTaskId: taskId, category });
      await triggerQueueIfNeeded();
    } else {
      // Fallback if Qualtrol is missing: keep previous hal-review behavior
      fetch('http://localhost:3003/api/hal-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId,
          taskTitle: task.title,
          agentName: task.agent_name || task.assignee_name || 'unknown',
          category,
          content: taskContent,
        }),
      }).then(r => r.json()).then(data => {
        console.log(`[HalReview] Fallback review request for "${task.title}":`, data.message || data.error);
      }).catch(err => console.error('[HalReview] Fallback failed:', err));
    }

    // Auto-post to social media if this is a social content task
    const taskTitle = (task.title || '').toLowerCase();
    const isSocial = taskTags.some((t: string) => ['social', 'instagram', 'twitter', 'x', 'tiktok', 'caption'].includes(t.toLowerCase()))
      || taskTitle.includes('instagram') || taskTitle.includes('caption') || taskTitle.includes('social') || taskTitle.includes('tweet');

    if (isSocial) {
      // Get the latest result to extract post text
      const latestResult = await db.get(`
        SELECT response FROM task_results WHERE task_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1
      `, [taskId]) as { response: string } | undefined;

      if (latestResult) {
        // Try to parse ContentMill's JSON array format: [{platform, caption, image_url}, ...]
        // Fall back to legacy ---separator format
        interface SocialPost { platform: string; caption?: string; text?: string; image_url?: string; }
        let platformPosts: SocialPost[] = [];

        try {
          const jsonMatch = latestResult.response.match(/```json\s*([\s\S]*?)```/i)
            || latestResult.response.match(/(\[\s*\{[\s\S]*\}\s*\])/);
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[1]);
            if (Array.isArray(parsed) && parsed[0]?.platform) {
              platformPosts = parsed;
            }
          }
        } catch { /* fall through to legacy */ }

        if (platformPosts.length > 0) {
          // New JSON format — send each platform its own caption + image
          for (const post of platformPosts) {
            const platform = post.platform?.toLowerCase();
            if (!['x', 'instagram', 'twitter'].includes(platform)) continue;
            const normalizedPlatform = platform === 'twitter' ? 'x' : platform;
            const text = (post.caption || post.text || '').trim();
            if (!text) continue;

            fetch('http://localhost:3003/api/social', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text,
                platforms: [normalizedPlatform],
                taskId,
                postNow: true,
                ...(post.image_url ? { media: { imageUrl: post.image_url } } : {}),
              }),
            }).then(r => r.json()).then(data => {
              console.log(`[Social] ${normalizedPlatform} post for "${task.title}":`, data.results?.map((r: {platform: string; ok: boolean}) => `${r.platform}:${r.ok}`).join(', '));
            }).catch(err => console.error('[Social] Failed:', err));
          }
        } else {
          // Legacy: posts separated by ---
          const posts = latestResult.response
            .split(/\n---\n/)
            .map((p: string) => p.trim())
            .filter((p: string) => p.length > 10 && p.length < 2200);

          for (const postText of posts.slice(0, 3)) {
            fetch('http://localhost:3003/api/social', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                text: postText.replace(/^\*\*.*?\*\*\n*/m, '').replace(/^#+\s.*\n*/gm, '').trim(),
                platforms: ['x', 'instagram'],
                taskId,
                postNow: true,
              }),
            }).then(r => r.json()).then(data => {
              console.log(`[Social] Posted for "${task.title}":`, data.results?.map((r: {platform: string; ok: boolean}) => `${r.platform}:${r.ok}`).join(', '));
            }).catch(err => console.error('[Social] Failed:', err));
          }
        }
      }
    }

    // If this is a strategic/BizOps task, create implementation tasks from the recommendations
    const agentCodename = (task as any).agent_codename || '';
    const strategicCodenames = ['BIZOPS', 'COACH', 'FEEDBACK', 'COMMUNITY', 'SEOHAWK'];
    const isStrategic = strategicCodenames.includes(agentCodename.toUpperCase());

    if (isStrategic) {
      const latestStratResult = await db.get(
        `SELECT response FROM task_results WHERE task_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1`,
        [taskId]
      ) as { response: string } | undefined;

      if (latestStratResult) {
        // Use the Producer to break down the strategy into implementation tasks
        const implTaskId = uuid();
        const implDesc = `**Andrew approved this strategy from ${task.agent_name || 'BizOps'}. Break it down into concrete implementation tasks and delegate to the right agents.**

## Approved Strategy: ${task.title}

${latestStratResult.response}

---

Create 2-5 specific, actionable implementation tasks. Assign each to the most appropriate agent:
- CONTENTMILL for marketing copy, social posts, landing page updates
- SEOHAWK for SEO changes
- LESSON_ARCHITECT for course/lesson content
- TABSMITH for tab/lick content
- THEORYBOT for music theory content
- TRACKMASTER for audio/backing tracks
- COACH for practice plans

Use the delegate_task tool for each implementation task. Be specific in the instructions.`;

        // Find the Producer agent
        const producer = await db.get(
          `SELECT id FROM agents WHERE UPPER(codename) = 'PRODUCER'`
        ) as { id: string } | undefined;

        if (producer) {
          await db.run(`
            INSERT INTO tasks (id, title, description, status, priority, assignee_id, tags, depends_on, created_at, updated_at)
            VALUES ($1, $2, $3, 'todo', 'high', $4, '["implementation", "delegated-strategy"]', $5, NOW(), NOW())
          `, [implTaskId, `Implement: ${task.title}`, implDesc, producer.id, taskId]);

          await postCommsMessage(SYSTEM_AGENT_ID,
            `🚀 Strategy approved: **${task.title}**. Implementation task created — Producer will break it down and delegate to the team.`,
            'system'
          );
        }
      }
    }

    await checkAndTriggerProducer();
    return NextResponse.json({ ok: true, message: 'Task approved and completed.' });
  }

  if (action === 'reject') {
    if (!feedback) {
      return NextResponse.json({ error: 'Feedback required for rejection' }, { status: 400 });
    }

    const newDesc = `${task.description || ''}\n\n---\n**Review Feedback (Rejected):** ${feedback}`.trim();

    await db.run(`
      UPDATE tasks SET status = 'todo', description = $1, updated_at = NOW()
      WHERE id = $2
    `, [newDesc, taskId]);

    // Delete the completed result so agent re-runs fresh
    await db.run(`DELETE FROM task_results WHERE task_id = $1 AND status = 'completed'`, [taskId]);

    triggerQueueIfNeeded();

    // Log review activity
    await logActivity('review', `Task reject: ${task.title}`, feedback || '', null, { 
      taskId: task.id, 
      action: 'reject', 
      taggedAgents: [] 
    });

    // Post rejection comms message
    const assigneeName = task.agent_name || 'Agent';
    await postCommsMessage(SYSTEM_AGENT_ID, `❌ Task rejected: **${task.title}**. Feedback: ${feedback}. @${assigneeName} — please review the feedback and re-do this task.`, 'alert', task.assignee_id || null);

    await checkAndTriggerProducer();
    return NextResponse.json({ ok: true, message: 'Task rejected and returned to todo.' });
  }

  if (action === 'revise') {
    if (!feedback) {
      return NextResponse.json({ error: 'Feedback required for revision' }, { status: 400 });
    }

    // Approve the original task first
    await db.run(`
      UPDATE tasks SET status = 'done', completed_at = NOW(), updated_at = NOW()
      WHERE id = $1
    `, [taskId]);

    // Create a new revision task
    const newId = uuid();
    const reviseDesc = `**Revision of:** ${task.title}\n**Feedback:** ${feedback}\n\n---\nOriginal description:\n${task.description || '(none)'}`;

    await db.run(`
      INSERT INTO tasks (id, title, description, status, priority, assignee_id, tags, depends_on, created_at, updated_at)
      VALUES ($1, $2, $3, 'todo', $4, $5, $6, $7, NOW(), NOW())
    `, [
      newId,
      `Revise: ${task.title}`,
      reviseDesc,
      task.priority,
      task.assignee_id,
      task.tags || '[]',
      taskId,
    ]);

    triggerQueueIfNeeded();

    // Log review activity
    await logActivity('review', `Task revise: ${task.title}`, feedback || '', null, { 
      taskId: task.id, 
      action: 'revise', 
      taggedAgents: [] 
    });

    // Post revision comms message
    const reviseAgentName = task.agent_name || 'Agent';
    await postCommsMessage(SYSTEM_AGENT_ID, `🔄 Revision requested: **${task.title}**. Feedback: ${feedback}. @${reviseAgentName} — a revision task has been created for you.`, 'alert', task.assignee_id || null);

    await checkAndTriggerProducer();
    return NextResponse.json({ ok: true, message: 'Revision task created.', newTaskId: newId });
  }

  return NextResponse.json({ error: 'Unknown action. Use approve, reject, or revise.' }, { status: 400 });
}

/**
 * After any review action, check if the review queue is empty.
 * If so and no todo/in_progress tasks remain, auto-trigger the Producer.
 */
async function checkAndTriggerProducer() {
  const db = getDb();
  const review = await db.get("SELECT COUNT(*) as c FROM tasks WHERE status = 'review'", []) as { c: number };
  if (review.c > 0) return; // still items to review

  const active = await db.get("SELECT COUNT(*) as c FROM tasks WHERE status IN ('todo', 'in_progress')", []) as { c: number };
  if (active.c > 0) return; // agents still working

  // Queue is dry — trigger Producer
  fetch('http://localhost:3003/api/produce/auto', {
    method: 'POST',
  }).then(r => r.json()).then(data => {
    if (data.ok) console.log('[AutoProduce] Review queue empty — triggered Producer');
    else if (data.skipped) console.log('[AutoProduce] Skipped — Producer already active');
  }).catch(err => console.error('[AutoProduce] Failed:', err));
}
