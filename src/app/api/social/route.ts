import { NextRequest, NextResponse } from 'next/server';
import { postToSocial } from '@/lib/social';
import { getDb } from '@/lib/db';
import { logActivity } from '@/lib/activityLog';
import { v4 as uuid } from 'uuid';

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

  const db = getDb();
  
  // Log activity and create calendar events for successful posts
  for (const result of results) {
    if (result.ok) {
      await logActivity('social', `Posted to ${result.platform}`, text.substring(0, 200), null, { 
        platform: result.platform, 
        postId: result.id 
      });

      // Create calendar event for the post
      await db.run(
        'INSERT INTO calendar_events (id, title, description, event_type, start_time, metadata) VALUES ($1, $2, $3, $4, NOW(), $5)',
        [uuid(), `Social: ${result.platform} post`, text.substring(0, 200), 'social', JSON.stringify({ 
          platform: result.platform, 
          postId: result.id 
        })]
      );
    }
  }

  // Log to MC messages if taskId provided
  if (taskId) {
    for (const r of results) {
      const status = r.ok ? '✅' : '❌';
      const msg = `${status} Social post to ${r.platform}: ${r.ok ? `Posted (ID: ${r.id || 'queued'})` : r.error}`;
      await db.run("INSERT INTO messages (id, content, type) VALUES ($1, $2, 'system')", 
        [uuid(), msg]);
    }
  }

  const allOk = results.every(r => r.ok);
  return NextResponse.json({
    ok: allOk,
    results,
  }, { status: allOk ? 200 : 207 });
}
