import { NextRequest, NextResponse } from 'next/server';
import { postToSocial } from '@/lib/social';
import { getDb } from '@/lib/db';

/**
 * GET /api/social — list connected profiles
 */
export async function GET() {
  // TODO: Implement getBufferProfiles when Buffer integration is needed
  const profiles: any[] = [];
  const xConfigured = !!(process.env.X_API_KEY && process.env.X_ACCESS_TOKEN);

  return NextResponse.json({
    x: { configured: xConfigured },
    buffer: profiles,
  });
}

/**
 * POST /api/social — post to social media
 * 
 * Body:
 * - text: string (the post content)
 * - platforms: string[] (x, instagram, tiktok, all)
 * - taskId?: string (link to MC task for tracking)
 * - scheduleAt?: string (ISO date for scheduling via Buffer)
 * - postNow?: boolean (post immediately)
 * - media?: { link?: string, photo?: string }
 */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const { text, platforms, taskId, scheduleAt, postNow, media } = body;

  if (!text || !platforms || !Array.isArray(platforms)) {
    return NextResponse.json({ error: 'text and platforms[] required' }, { status: 400 });
  }

  const results = await postToSocial({
    text,
    platforms,
    scheduleAt,
    postNow: postNow ?? true,
    media,
  });

  // Log to MC messages if taskId provided
  if (taskId) {
    const db = getDb();
    for (const r of results) {
      const status = r.ok ? '✅' : '❌';
      const msg = `${status} Social post to ${r.platform}: ${r.ok ? `Posted (ID: ${r.id || 'queued'})` : r.error}`;
      db.prepare("INSERT INTO messages (id, content, type) VALUES (?, ?, 'system')")
        .run(require('uuid').v4(), msg);
    }
  }

  const allOk = results.every(r => r.ok);
  return NextResponse.json({
    ok: allOk,
    results,
  }, { status: allOk ? 200 : 207 });
}
