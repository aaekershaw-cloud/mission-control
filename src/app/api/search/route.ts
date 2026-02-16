import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

interface SearchResult {
  type: 'agent' | 'task' | 'message';
  id: string;
  title: string;
  subtitle: string;
}

export async function GET(request: NextRequest) {
  try {
    const db = getDb();
    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q')?.trim();

    if (!q || q.length < 2) {
      return NextResponse.json([]);
    }

    const pattern = `%${q}%`;
    const results: SearchResult[] = [];

    // Search agents
    const agents = db.prepare(`
      SELECT id, name, codename, avatar, role
      FROM agents
      WHERE name LIKE ? OR codename LIKE ? OR role LIKE ?
      LIMIT 5
    `).all(pattern, pattern, pattern) as Array<{
      id: string;
      name: string;
      codename: string;
      avatar: string;
      role: string;
    }>;

    for (const a of agents) {
      results.push({
        type: 'agent',
        id: a.id,
        title: `${a.avatar} ${a.name}`,
        subtitle: a.role,
      });
    }

    // Search tasks
    const tasks = db.prepare(`
      SELECT id, title, description, status, priority
      FROM tasks
      WHERE title LIKE ? OR description LIKE ?
      LIMIT 5
    `).all(pattern, pattern) as Array<{
      id: string;
      title: string;
      description: string;
      status: string;
      priority: string;
    }>;

    for (const t of tasks) {
      results.push({
        type: 'task',
        id: t.id,
        title: t.title,
        subtitle: `${t.status.replace('_', ' ')} / ${t.priority}`,
      });
    }

    // Search messages
    const messages = db.prepare(`
      SELECT m.id, m.content, a.name AS from_name, a.avatar AS from_avatar
      FROM messages m
      LEFT JOIN agents a ON m.from_agent_id = a.id
      WHERE m.content LIKE ?
      LIMIT 5
    `).all(pattern) as Array<{
      id: string;
      content: string;
      from_name: string | null;
      from_avatar: string | null;
    }>;

    for (const m of messages) {
      results.push({
        type: 'message',
        id: m.id,
        title: m.content.length > 60 ? m.content.slice(0, 60) + '...' : m.content,
        subtitle: m.from_name ? `From ${m.from_name}` : 'System message',
      });
    }

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET /api/search error:', error);
    return NextResponse.json(
      { error: 'Search failed' },
      { status: 500 }
    );
  }
}
