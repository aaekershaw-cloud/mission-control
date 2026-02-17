import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const rows = db.prepare('SELECT * FROM provider_configs ORDER BY is_default DESC, created_at ASC').all() as Record<string, unknown>[];
    
    const providers = rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      baseUrl: row.base_url,
      apiKey: row.api_key ? '••••' + String(row.api_key).slice(-8) : '',
      model: row.model,
      contextWindow: row.context_window,
      maxTokens: row.max_tokens,
      isDefault: row.is_default === 1,
      createdAt: row.created_at,
    }));

    return NextResponse.json(providers);
  } catch (error) {
    console.error('GET /api/providers error:', error);
    return NextResponse.json({ error: 'Failed to fetch providers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const db = getDb();
    const body = await request.json();

    const { type, name, baseUrl, apiKey, model, contextWindow = 131072, maxTokens = 8192, isDefault = false } = body;

    if (!type || !name || !baseUrl || !apiKey || !model) {
      return NextResponse.json({ error: 'type, name, baseUrl, apiKey, and model are required' }, { status: 400 });
    }

    // Check if provider of this type already exists — update it
    const existing = db.prepare('SELECT id FROM provider_configs WHERE type = ?').get(type) as { id: string } | undefined;

    if (existing) {
      db.prepare(`
        UPDATE provider_configs 
        SET name = ?, base_url = ?, api_key = ?, model = ?, context_window = ?, max_tokens = ?, is_default = ?
        WHERE id = ?
      `).run(name, baseUrl, apiKey, model, contextWindow, maxTokens, isDefault ? 1 : 0, existing.id);

      if (isDefault) {
        db.prepare('UPDATE provider_configs SET is_default = 0 WHERE id != ?').run(existing.id);
      }

      return NextResponse.json({ success: true, id: existing.id, action: 'updated' });
    }

    const id = uuid();

    if (isDefault) {
      db.prepare('UPDATE provider_configs SET is_default = 0').run();
    }

    db.prepare(`
      INSERT INTO provider_configs (id, type, name, base_url, api_key, model, context_window, max_tokens, is_default)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, type, name, baseUrl, apiKey, model, contextWindow, maxTokens, isDefault ? 1 : 0);

    return NextResponse.json({ success: true, id, action: 'created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/providers error:', error);
    return NextResponse.json({ error: 'Failed to save provider' }, { status: 500 });
  }
}
