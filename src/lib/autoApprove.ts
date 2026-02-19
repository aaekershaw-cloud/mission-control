import { getDb } from '@/lib/db';
import { autoReviewTask, AutoReviewResult } from '@/lib/autoReview';
import { triggerQueueIfNeeded } from '@/lib/autoQueue';
import { unlockDependentTasks } from '@/lib/executor';
import { v4 as uuid } from 'uuid';
import { logActivity } from '@/lib/activityLog';

const SYSTEM_AGENT_ID = 'system';

async function postCommsMessage(fromAgentId: string, content: string, type: string, toAgentId: string | null = null) {
  const db = getDb();
  const id = uuid();
  await db.run(
    `INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at) VALUES ($1, $2, $3, $4, $5, NOW())`,
    [id, fromAgentId, toAgentId, content, type]
  );
}

export async function processAutoReview(taskId: string): Promise<void> {
  const db = getDb();
  
  // Get the task info for messaging
  const task = await db.get(`
    SELECT t.*, a.name as agent_name, a.avatar as agent_avatar
    FROM tasks t
    LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.id = $1
  `, [taskId]) as Record<string, string> | undefined;

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  // Run auto-review
  const reviewResult = await autoReviewTask(taskId);

  // Store the auto-review result in database
  const reviewId = uuid();
  await db.run(`
    INSERT INTO auto_reviews (id, task_id, decision, reasons, checks, repaired_content, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, NOW())
  `, [
    reviewId,
    taskId,
    reviewResult.decision,
    JSON.stringify(reviewResult.reasons),
    JSON.stringify(reviewResult.checks),
    reviewResult.repairedContent || null
  ]);

  // Process the decision
  switch (reviewResult.decision) {
    case 'approve':
      // Update task status to done
      await db.run(`
        UPDATE tasks SET status = 'done', completed_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `, [taskId]);

      // Log auto-review decision
      await logActivity('review', `Auto-approve: ${task.title}`, reviewResult.reasons.join(', '), null, { 
        taskId: task.id, 
        decision: 'approve', 
        autoReview: true 
      });

      // Post success message
      const passedChecks = reviewResult.checks.filter(c => c.passed).map(c => c.name);
      await postCommsMessage(
        SYSTEM_AGENT_ID,
        `🤖 Auto-approved: **${task.title}**. Checks passed: ${passedChecks.join(', ')}.`,
        'system'
      );

      // Unlock dependent tasks and trigger queue
      await unlockDependentTasks(taskId);
      triggerQueueIfNeeded();

      // Auto-export approved content to website content directory
      try {
        await fetch('http://localhost:3003/api/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId }),
        });
      } catch (error) {
        console.error('[Export] Failed for auto-approved task:', error);
      }

      // Auto-post to social media if this is a social content task
      const taskTags = (task.tags as any) || []; // JSONB - already parsed
      const taskTitle = (task.title || '').toLowerCase();
      const isSocial = taskTags.some((t: string) => ['social', 'instagram', 'twitter', 'x', 'tiktok', 'caption'].includes(t.toLowerCase()))
        || taskTitle.includes('instagram') || taskTitle.includes('caption') || taskTitle.includes('social') || taskTitle.includes('tweet');

      if (isSocial) {
        try {
          const latestResult = await db.get(`
            SELECT response FROM task_results WHERE task_id = $1 AND status = 'completed' ORDER BY created_at DESC LIMIT 1
          `, [taskId]) as { response: string } | undefined;

          if (latestResult) {
            const posts = latestResult.response
              .split(/\n---\n/)
              .map(p => p.trim())
              .filter(p => p.length > 10 && p.length < 2200);

            // Use repaired content if available
            const contentToPost = reviewResult.repairedContent || latestResult.response;

            for (const postText of posts.slice(0, 3)) {
              await fetch('http://localhost:3003/api/social', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  text: postText.replace(/^\*\*.*?\*\*\n*/m, '').replace(/^#+\s.*\n*/gm, '').trim(),
                  platforms: ['x', 'instagram'],
                  taskId,
                  postNow: false,
                }),
              });
            }
          }
        } catch (error) {
          console.error('[Social] Failed for auto-approved task:', error);
        }
      }
      break;

    case 'reject':
      // Get current retry count
      const currentRetryCount = parseInt(task.retry_count || '0');
      const newRetryCount = currentRetryCount + 1;

      // Log auto-review decision
      await logActivity('review', `Auto-reject: ${task.title}`, reviewResult.reasons.join(', '), null, { 
        taskId: task.id, 
        decision: 'reject', 
        autoReview: true 
      });

      if (newRetryCount >= 3) {
        // Too many retries, flag for human review
        await db.run(`
          UPDATE tasks SET status = 'review', retry_count = $1, updated_at = NOW()
          WHERE id = $2
        `, [newRetryCount, taskId]);

        await postCommsMessage(
          SYSTEM_AGENT_ID,
          `🤖 Auto-rejected 3 times: **${task.title}**. Flagging for human review. Reasons: ${reviewResult.reasons.join(', ')}.`,
          'alert',
          task.assignee_id || null
        );
      } else {
        // Reset to todo for retry
        await db.run(`
          UPDATE tasks SET status = 'todo', retry_count = $1, updated_at = NOW()
          WHERE id = $2
        `, [newRetryCount, taskId]);

        // Delete the completed result so agent re-runs fresh
        await db.run(`DELETE FROM task_results WHERE task_id = $1 AND status = 'completed'`, [taskId]);

        await postCommsMessage(
          SYSTEM_AGENT_ID,
          `🤖 Auto-rejected: **${task.title}**. Reasons: ${reviewResult.reasons.join(', ')}. Retrying (attempt ${newRetryCount + 1}/3).`,
          'system'
        );

        triggerQueueIfNeeded();
      }
      break;

    case 'flag':
      // Log auto-review decision
      await logActivity('review', `Auto-flag: ${task.title}`, reviewResult.reasons.join(', '), null, { 
        taskId: task.id, 
        decision: 'flag', 
        autoReview: true 
      });

      // Keep status as review, post flag message
      await postCommsMessage(
        SYSTEM_AGENT_ID,
        `👀 Flagged for review: **${task.title}**. Reasons: ${reviewResult.reasons.join(', ')}.`,
        'alert'
      );
      break;
  }
}