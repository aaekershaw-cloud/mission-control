import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { logActivity } from '@/lib/activityLog';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const platform = searchParams.get('platform');
    
    let query = `
      SELECT 
        cp.*,
        a.name as agent_name,
        a.avatar as agent_avatar
      FROM content_pipeline cp
      LEFT JOIN agents a ON cp.assigned_agent_id = a.id
      ORDER BY 
        CASE cp.stage 
          WHEN 'idea' THEN 1
          WHEN 'writing' THEN 2
          WHEN 'review' THEN 3
          WHEN 'assets' THEN 4
          WHEN 'scheduled' THEN 5
          WHEN 'published' THEN 6
          ELSE 7
        END,
        cp.created_at DESC
    `;
    
    const params = [];
    
    if (platform) {
      query = `
        SELECT 
          cp.*,
          a.name as agent_name,
          a.avatar as agent_avatar
        FROM content_pipeline cp
        LEFT JOIN agents a ON cp.assigned_agent_id = a.id
        WHERE cp.platform = $1
        ORDER BY 
          CASE cp.stage 
            WHEN 'idea' THEN 1
            WHEN 'writing' THEN 2
            WHEN 'review' THEN 3
            WHEN 'assets' THEN 4
            WHEN 'scheduled' THEN 5
            WHEN 'published' THEN 6
            ELSE 7
          END,
          cp.created_at DESC
      `;
      params.push(platform);
    }
    
    const content = await db.all(query, params);
    
    return NextResponse.json(content);
  } catch (error) {
    console.error('Content pipeline GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch content' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const data = await request.json();
    
    const content = {
      id: uuid(),
      title: data.title,
      body: data.body || '',
      stage: data.stage || 'idea',
      platform: data.platform || 'blog',
      assigned_agent_id: data.assigned_agent_id || null,
      thumbnail_url: data.thumbnail_url || null,
      publish_date: data.publish_date || null,
      notes: data.notes || '',
      tags: JSON.stringify(data.tags || []),
      metadata: JSON.stringify(data.metadata || {}),
    };
    
    await db.run(`
      INSERT INTO content_pipeline (
        id, title, body, stage, platform, assigned_agent_id, 
        thumbnail_url, publish_date, notes, tags, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `, [
      content.id,
      content.title,
      content.body,
      content.stage,
      content.platform,
      content.assigned_agent_id,
      content.thumbnail_url,
      content.publish_date,
      content.notes,
      content.tags,
      content.metadata
    ]);
    
    return NextResponse.json({ success: true, content });
  } catch (error) {
    console.error('Content pipeline POST error:', error);
    return NextResponse.json({ error: 'Failed to create content' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const db = getDb();
    const data = await request.json();
    const { id, ...updates } = data;
    
    if (!id) {
      return NextResponse.json({ error: 'Content ID required' }, { status: 400 });
    }

    // Get current item to track stage changes
    const currentItem = await db.get('SELECT * FROM content_pipeline WHERE id = $1', [id]) as Record<string, any> | undefined;
    if (!currentItem) {
      return NextResponse.json({ error: 'Content not found' }, { status: 404 });
    }
    
    const updateFields = [];
    const values = [];
    let paramIndex = 1;
    
    Object.keys(updates).forEach(key => {
      if (key === 'tags' || key === 'metadata') {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(JSON.stringify(updates[key]));
      } else {
        updateFields.push(`${key} = $${paramIndex}`);
        values.push(updates[key]);
      }
      paramIndex++;
    });
    
    if (updateFields.length === 0) {
      return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
    }
    
    updateFields.push(`updated_at = NOW()`);
    values.push(id);
    
    const query = `
      UPDATE content_pipeline 
      SET ${updateFields.join(', ')}
      WHERE id = $${paramIndex}
    `;
    
    await db.run(query, values);

    // Log stage change if it occurred
    const oldStage = currentItem.stage;
    const newStage = updates.stage;
    if (newStage && newStage !== oldStage) {
      await logActivity('content', `Content moved to ${newStage}: ${currentItem.title}`, '', currentItem.assigned_agent_id, { 
        itemId: id, 
        fromStage: oldStage, 
        toStage: newStage 
      });

      // Auto-trigger social posting if stage changed to 'published' and platform is social
      if (newStage === 'published' && ['x', 'twitter', 'instagram', 'tiktok'].includes(currentItem.platform)) {
        const platformMap: Record<string, string> = { twitter: 'x', x: 'x', instagram: 'instagram', tiktok: 'tiktok' };
        try {
          const response = await fetch(`http://localhost:${process.env.PORT || 3003}/api/social`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: currentItem.body
                .replace(/^(\s*#{1,4}\s.*\n+|\s*\*\*[^*]+\*\*\s*\n+|\s*---\s*\n+)+/, '') // strip leading headers
                .replace(/\*\*(.+?)\*\*/g, '$1') // strip bold markdown
                .replace(/\*(.+?)\*/g, '$1') // strip italic markdown
                .replace(/^#+\s*/gm, '') // strip # headers
                .trim()
                .substring(0, 2000),
              platforms: [platformMap[currentItem.platform] || currentItem.platform],
              postNow: true,
            }),
          });
          
          if (response.ok) {
            await logActivity('social', `Auto-posted to ${currentItem.platform}: ${currentItem.title}`, currentItem.body.substring(0, 200), null, { 
              platform: currentItem.platform, 
              itemId: id 
            });
          } else {
            console.error('Auto-social posting failed:', await response.text());
          }
        } catch (error) {
          console.error('Auto-social posting failed:', error);
        }
      }
    }
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Content pipeline PUT error:', error);
    return NextResponse.json({ error: 'Failed to update content' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    
    if (!id) {
      return NextResponse.json({ error: 'Content ID required' }, { status: 400 });
    }
    
    await db.run('DELETE FROM content_pipeline WHERE id = $1', [id]);
    
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Content pipeline DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete content' }, { status: 500 });
  }
}