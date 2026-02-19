import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';

export async function GET() {
  try {
    const db = getDb();
    const rows = await db.all('SELECT * FROM provider_configs ORDER BY is_default DESC, created_at ASC') as Record<string, unknown>[];
    
    const providers = rows.map((row) => ({
      id: row.id,
      type: row.type,
      name: row.name,
      baseUrl: row.base_url,
      apiKey: row.api_key ? '••••' + String(row.api_key).slice(-8) : '',
      model: row.model,
      contextWindow: row.context_window,
      maxTokens: row.max_tokens,
      isDefault: row.is_default === true,
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
    const existing = await db.get('SELECT id FROM provider_configs WHERE type = $1', [type]) as { id: string } | undefined;

    if (existing) {
      await db.run(`
        UPDATE provider_configs 
        SET name = $1, base_url = $2, api_key = $3, model = $4, context_window = $5, max_tokens = $6, is_default = $7
        WHERE id = $8
      `, [name, baseUrl, apiKey, model, contextWindow, maxTokens, isDefault, existing.id]);

      if (isDefault) {
        await db.run('UPDATE provider_configs SET is_default = false WHERE id != $1', [existing.id]);
      }

      return NextResponse.json({ success: true, id: existing.id, action: 'updated' });
    }

    const id = uuid();

    if (isDefault) {
      await db.run('UPDATE provider_configs SET is_default = false');
    }

    await db.run(`
      INSERT INTO provider_configs (id, type, name, base_url, api_key, model, context_window, max_tokens, is_default)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `, [id, type, name, baseUrl, apiKey, model, contextWindow, maxTokens, isDefault]);

    return NextResponse.json({ success: true, id, action: 'created' }, { status: 201 });
  } catch (error) {
    console.error('POST /api/providers error:', error);
    return NextResponse.json({ error: 'Failed to save provider' }, { status: 500 });
  }
}
