import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const year = parseInt(searchParams.get('year') || new Date().getFullYear().toString());
    const month = parseInt(searchParams.get('month') || (new Date().getMonth() + 1).toString());
    const filters = searchParams.get('filters')?.split(',') || [];
    
    const allEvents = [];
    
    // Get manual events (including social posts)
    if (!filters.length || filters.includes('manual') || filters.includes('social')) {
      const events = await db.all(`
        SELECT * FROM calendar_events 
        WHERE EXTRACT(YEAR FROM start_time) = $1 
        AND EXTRACT(MONTH FROM start_time) = $2
        ORDER BY start_time
      `, [year, month]);
      
      allEvents.push(...events.map(e => ({
        id: e.id,
        title: e.title,
        description: e.description,
        type: e.event_type,
        start: e.start_time,
        end: e.end_time,
        allDay: e.all_day,
        color: e.color,
        metadata: typeof e.metadata === 'string' ? JSON.parse(e.metadata) : e.metadata,
      })));
    }
    
    // Get tasks with due dates
    if (!filters.length || filters.includes('tasks')) {
      const taskEvents = await db.all(`
        SELECT 
          t.id,
          t.title,
          t.description,
          t.status,
          t.priority,
          COALESCE(t.completed_at, t.created_at + INTERVAL '7 days') as event_date,
          a.name as agent_name,
          a.avatar as agent_avatar
        FROM tasks t
        LEFT JOIN agents a ON t.assignee_id = a.id
        WHERE 
          (t.completed_at IS NOT NULL OR t.status != 'done')
          AND EXTRACT(YEAR FROM COALESCE(t.completed_at, t.created_at + INTERVAL '7 days')) = $1
          AND EXTRACT(MONTH FROM COALESCE(t.completed_at, t.created_at + INTERVAL '7 days')) = $2
      `, [year, month]);
      
      allEvents.push(...taskEvents.map(t => ({
        id: `task-${t.id}`,
        title: `Task: ${t.title}`,
        description: t.description || '',
        type: 'task',
        start: t.event_date,
        end: t.event_date,
        allDay: false,
        color: '#10b981', // emerald-500
        metadata: { 
          status: t.status, 
          priority: t.priority, 
          agent: t.agent_name,
          avatar: t.agent_avatar 
        },
      })));
    }
    
    // Get content with publish dates
    if (!filters.length || filters.includes('content')) {
      const contentEvents = await db.all(`
        SELECT 
          id, title, platform, stage, publish_date, assigned_agent_id
        FROM content_pipeline
        WHERE publish_date IS NOT NULL
        AND EXTRACT(YEAR FROM publish_date) = $1
        AND EXTRACT(MONTH FROM publish_date) = $2
      `, [year, month]);
      
      allEvents.push(...contentEvents.map(c => ({
        id: `content-${c.id}`,
        title: `Publish: ${c.title}`,
        description: c.platform,
        type: 'content',
        start: c.publish_date,
        end: c.publish_date,
        allDay: false,
        color: '#f97316', // orange-500
        metadata: { platform: c.platform, stage: c.stage },
      })));
    }
    
    // Sort by start time
    allEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
    
    return NextResponse.json(allEvents);
  } catch (error) {
    console.error('Calendar API error:', error);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const data = await request.json();
    
    const event = {
      id: uuid(),
      title: data.title,
      description: data.description || '',
      event_type: 'manual',
      start_time: data.start_time,
      end_time: data.end_time || null,
      all_day: data.all_day || false,
      color: data.color || '#f59e0b',
      metadata: JSON.stringify(data.metadata || {}),
    };
    
    await db.run(`
      INSERT INTO calendar_events (id, title, description, event_type, start_time, end_time, all_day, color, metadata)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [
      event.id,
      event.title, 
      event.description,
      event.event_type,
      event.start_time,
      event.end_time,
      event.all_day,
      event.color,
      event.metadata
    ]);
    
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('Calendar create error:', error);
    return NextResponse.json({ error: 'Failed to create calendar event' }, { status: 500 });
  }
}