import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { LOOP_LIMITS } from '@/lib/loopControls';

export async function GET() {
  try {
    const db = getDb();
    const row = await db.get(`SELECT * FROM loop_controls WHERE id = 'singleton'`, []) as any;
    return NextResponse.json({
      maxTodoPerAgent: Number(row?.max_todo_per_agent ?? LOOP_LIMITS.maxTodoPerAgent),
      maxReviewPerContentCategory: Number(row?.max_review_per_content_category ?? LOOP_LIMITS.maxReviewPerContentCategory),
      stagingBlockThresholdPerCategory: Number(row?.staging_block_threshold ?? LOOP_LIMITS.stagingBlockThresholdPerCategory),
    });
  } catch (error) {
    console.error('GET /api/loop-controls error:', error);
    return NextResponse.json({ error: 'Failed to fetch loop controls' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();
    const maxTodoPerAgent = Math.max(1, Math.min(10, Number(body.maxTodoPerAgent ?? LOOP_LIMITS.maxTodoPerAgent)));
    const maxReviewPerContentCategory = Math.max(1, Math.min(20, Number(body.maxReviewPerContentCategory ?? LOOP_LIMITS.maxReviewPerContentCategory)));
    const stagingBlockThresholdPerCategory = Math.max(1, Math.min(50, Number(body.stagingBlockThresholdPerCategory ?? LOOP_LIMITS.stagingBlockThresholdPerCategory)));

    await db.run(
      `UPDATE loop_controls
       SET max_todo_per_agent = $1,
           max_review_per_content_category = $2,
           staging_block_threshold = $3,
           updated_at = NOW()
       WHERE id = 'singleton'`,
      [maxTodoPerAgent, maxReviewPerContentCategory, stagingBlockThresholdPerCategory]
    );

    return NextResponse.json({
      ok: true,
      maxTodoPerAgent,
      maxReviewPerContentCategory,
      stagingBlockThresholdPerCategory,
    });
  } catch (error) {
    console.error('PUT /api/loop-controls error:', error);
    return NextResponse.json({ error: 'Failed to update loop controls' }, { status: 500 });
  }
}
