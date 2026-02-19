import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const eventType = searchParams.get('type');
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    
    let query = `
      SELECT 
        al.*,
        a.name as agent_name,
        a.avatar as agent_avatar
      FROM activity_log al
      LEFT JOIN agents a ON al.agent_id = a.id
    `;
    
    const params = [];
    const conditions = [];
    
    if (eventType && eventType !== 'all') {
      conditions.push(`al.event_type = $${params.length + 1}`);
      params.push(eventType);
    }
    
    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    query += ` ORDER BY al.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    const activities = await db.all(query, params);
    
    // Parse metadata for each activity
    const formattedActivities = activities.map(activity => ({
      ...activity,
      metadata: typeof activity.metadata === 'string' 
        ? JSON.parse(activity.metadata) 
        : activity.metadata || {},
    }));
    
    return NextResponse.json(formattedActivities);
  } catch (error) {
    console.error('Activity API error:', error);
    return NextResponse.json({ error: 'Failed to fetch activities' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const data = await request.json();
    
    const activity = {
      id: uuid(),
      event_type: data.event_type,
      title: data.title,
      description: data.description || '',
      agent_id: data.agent_id || null,
      metadata: JSON.stringify(data.metadata || {}),
    };
    
    await db.run(`
      INSERT INTO activity_log (id, event_type, title, description, agent_id, metadata)
      VALUES ($1, $2, $3, $4, $5, $6)
    `, [
      activity.id,
      activity.event_type,
      activity.title,
      activity.description,
      activity.agent_id,
      activity.metadata
    ]);
    
    return NextResponse.json({ success: true, activity });
  } catch (error) {
    console.error('Activity log error:', error);
    return NextResponse.json({ error: 'Failed to log activity' }, { status: 500 });
  }
}