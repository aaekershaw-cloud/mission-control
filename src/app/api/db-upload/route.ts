import { NextRequest, NextResponse } from 'next/server';
import { writeFileSync } from 'fs';

export const config = {
  api: {
    bodyParser: false,
  },
};

// Next.js 16 route segment config for large body
export const maxDuration = 30;

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-upload-secret');
  if (secret !== process.env.UPLOAD_SECRET) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  
  const data = await req.arrayBuffer();
  const dbPath = process.env.DB_PATH || './mission-control.db';
  writeFileSync(dbPath, Buffer.from(data));
  
  return NextResponse.json({ ok: true, size: data.byteLength, path: dbPath });
}
