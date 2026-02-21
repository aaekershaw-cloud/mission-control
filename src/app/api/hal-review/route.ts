import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { exec } from 'child_process';

/**
 * POST /api/hal-review
 * 
 * Called after task approval to send content to Hal for review before staging export.
 * Uses `openclaw agent` CLI to trigger a review in Hal's session.
 * 
 * Body: { taskId, taskTitle, agentName, category, content }
 */
export async function POST(req: NextRequest) {
  try {
    const { taskId, taskTitle, agentName, category, content } = await req.json();

    if (!taskId || !content) {
      return NextResponse.json({ error: 'taskId and content required' }, { status: 400 });
    }

    // Store in pending_reviews table for tracking
    const db = getDb();
    await db.run(
      `INSERT INTO pending_reviews (task_id, task_title, agent_name, category, content, status, created_at)
       VALUES ($1, $2, $3, $4, $5, 'pending', NOW())
       ON CONFLICT (task_id) DO UPDATE SET content = $5, status = 'pending', created_at = NOW()`,
      [taskId, taskTitle, agentName || 'unknown', category || 'unknown', typeof content === 'string' ? content : JSON.stringify(content)]
    );

    // Build the review message
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
    const truncated = contentStr.substring(0, 6000);
    
    const message = [
      `[CONTENT REVIEW] New content approved and needs your review before staging.`,
      `Task: ${taskTitle}`,
      `Agent: ${agentName} | Category: ${category} | Task ID: ${taskId}`,
      ``,
      `Review this content for: grammar, factual accuracy, formatting, JSON structure issues, tab notation correctness.`,
      ``,
      `To review: GET http://localhost:3003/api/hal-review?taskId=${taskId}`,
      `To save corrections: PUT http://localhost:3003/api/hal-review (body: {"taskId":"${taskId}","content":"<corrected>"})`,
      `To export to staging: POST http://localhost:3003/api/export (body: {"taskId":"${taskId}"})`,
      ``,
      `Content preview:`,
      truncated.length < contentStr.length ? truncated + '\n...(truncated)' : truncated,
    ].join('\n');

    // Notify Hal via openclaw cron (one-shot immediate job)
    // Keep message short — full content is in the pending_reviews DB table
    const shortMsg = `[CONTENT REVIEW] Task approved: "${taskTitle}" by ${agentName}. Category: ${category}. Task ID: ${taskId}. Fetch full content from http://localhost:3003/api/hal-review?taskId=${taskId} — review for errors, then PUT corrections and export to staging.`;
    exec(
      `openclaw cron add --at "1m" --delete-after-run --name "review-${taskId.substring(0,8)}" --message "${shortMsg.replace(/"/g, '\\"')}"`,
      { timeout: 30000, env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin' } },
      (err, stdout) => {
        if (err) {
          console.error('[HalReview] cron add failed:', err.message);
          // Fallback: direct agent call
          exec(
            `openclaw agent -m "${shortMsg.replace(/"/g, '\\"')}" --channel webchat 2>&1`,
            { timeout: 60000, env: { ...process.env, PATH: process.env.PATH + ':/opt/homebrew/bin' } },
            (err2) => {
              if (err2) console.error('[HalReview] agent fallback also failed:', err2.message);
              else console.log('[HalReview] Agent turn triggered for:', taskTitle);
            }
          );
        } else {
          console.log('[HalReview] Cron job created for:', taskTitle);
        }
      }
    );

    console.log(`[HalReview] Queued review request for "${taskTitle}"`);
    return NextResponse.json({ ok: true, message: 'Review request sent to Hal' });
  } catch (error) {
    console.error('[HalReview] Error:', error);
    return NextResponse.json({ error: 'Failed to send review request' }, { status: 500 });
  }
}

/**
 * GET /api/hal-review?taskId=xxx — Get pending review content (full, not truncated)
 */
export async function GET(req: NextRequest) {
  const taskId = req.nextUrl.searchParams.get('taskId');
  const db = getDb();

  if (taskId) {
    const review = await db.get('SELECT * FROM pending_reviews WHERE task_id = $1', [taskId]) as Record<string, unknown> | undefined;
    if (!review) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(review);
  }

  // List all pending reviews
  const reviews = await db.all("SELECT task_id, task_title, agent_name, category, status, created_at, reviewed_at FROM pending_reviews ORDER BY created_at DESC LIMIT 20");
  return NextResponse.json(reviews);
}

/**
 * PUT /api/hal-review — Save corrected content and trigger export
 */
export async function PUT(req: NextRequest) {
  const { taskId, content, corrections, exportNow } = await req.json();
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

  const db = getDb();
  
  // Update the task result with corrected content if provided
  if (content) {
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    await db.run(
      'UPDATE task_results SET response = $1 WHERE task_id = $2',
      [contentStr, taskId]
    );
  }

  // Mark review as completed
  await db.run(
    "UPDATE pending_reviews SET status = 'reviewed', corrections = $1, reviewed_at = NOW() WHERE task_id = $2",
    [corrections || 'Reviewed - no corrections needed', taskId]
  );

  // Auto-export to staging after review
  if (exportNow !== false) {
    try {
      const baseUrl = `http://localhost:${process.env.PORT || 3003}`;
      const exportRes = await fetch(`${baseUrl}/api/export`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId }),
      });
      const exportData = await exportRes.json();
      console.log(`[HalReview] Export result for ${taskId}:`, exportData);
      return NextResponse.json({ ok: true, exported: exportData.exported || 0 });
    } catch (e) {
      console.error('[HalReview] Export failed:', e);
      return NextResponse.json({ ok: true, exported: 0, exportError: 'Export failed' });
    }
  }

  return NextResponse.json({ ok: true });
}
