import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { autoReviewTask } from '@/lib/autoReview';
import { processAutoReview } from '@/lib/autoApprove';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;
  const db = getDb();

  try {
    // Get the latest auto-review result for this task
    const autoReview = db.prepare(`
      SELECT * FROM auto_reviews 
      WHERE task_id = ? 
      ORDER BY created_at DESC 
      LIMIT 1
    `).get(taskId) as Record<string, unknown> | undefined;

    if (!autoReview) {
      return NextResponse.json({ error: 'No auto-review found for this task' }, { status: 404 });
    }

    // Parse JSON fields
    const result = {
      ...autoReview,
      reasons: JSON.parse(autoReview.reasons as string),
      checks: JSON.parse(autoReview.checks as string)
    };

    return NextResponse.json({ autoReview: result });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    // Check if task exists and has a completed result
    const db = getDb();
    const task = db.prepare(`
      SELECT t.*, tr.status as result_status
      FROM tasks t
      LEFT JOIN task_results tr ON t.id = tr.task_id AND tr.status = 'completed'
      WHERE t.id = ?
    `).get(taskId) as Record<string, unknown> | undefined;

    if (!task) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    if (!task.result_status) {
      return NextResponse.json({ error: 'Task has no completed result to review' }, { status: 400 });
    }

    // Run auto-review
    const reviewResult = await autoReviewTask(taskId);

    return NextResponse.json({ 
      ok: true,
      reviewResult,
      message: 'Auto-review completed successfully'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PUT endpoint to manually process the auto-review decision
export async function PUT(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: taskId } = await params;

  try {
    // Run full auto-review process (including decision execution)
    await processAutoReview(taskId);

    return NextResponse.json({ 
      ok: true,
      message: 'Auto-review processed and decision executed'
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}