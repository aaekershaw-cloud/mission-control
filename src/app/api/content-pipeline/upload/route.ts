import { NextRequest, NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { v4 as uuid } from 'uuid';

// On Railway, use persistent volume at /data/uploads
// Locally, use public/uploads as before
function getUploadDir() {
  if (process.env.RAILWAY_PUBLIC_DOMAIN) {
    return '/data/uploads';
  }
  return join(process.cwd(), 'public', 'uploads');
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm', 'video/x-msvideo',
    ];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ error: 'Invalid file type. Use JPG, PNG, GIF, WebP, MP4, MOV, or WebM.' }, { status: 400 });
    }

    // 100MB limit for video, 10MB for images
    const isVideo = file.type.startsWith('video/');
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return NextResponse.json({ error: `File too large (max ${isVideo ? '100MB' : '10MB'})` }, { status: 400 });
    }

    const ext = file.name.split('.').pop() || 'jpg';
    const filename = `${uuid()}.${ext}`;
    const uploadDir = getUploadDir();
    
    // Ensure upload directory exists
    await mkdir(uploadDir, { recursive: true });
    
    const filePath = join(uploadDir, filename);

    const bytes = await file.arrayBuffer();
    await writeFile(filePath, Buffer.from(bytes));

    const url = `/uploads/${filename}`;

    return NextResponse.json({ success: true, url, filename });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
