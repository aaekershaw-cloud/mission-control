import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const getMemoryDirectory = () => {
  return process.env.OPENCLAW_WORKSPACE || '/Users/andrewkershaw/.openclaw/workspace';
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const memoryDir = getMemoryDirectory();

    if (action === 'list') {
      // List all memory files
      const files = [];
      
      // Check for main files
      const mainFiles = ['MEMORY.md', 'TOOLS.md', 'USER.md', 'SOUL.md', 'IDENTITY.md'];
      for (const filename of mainFiles) {
        const filePath = path.join(memoryDir, filename);
        if (fs.existsSync(filePath)) {
          const stats = fs.statSync(filePath);
          files.push({
            name: filename,
            path: filename,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            type: 'main'
          });
        }
      }
      
      // Check memory subdirectory
      const memorySubDir = path.join(memoryDir, 'memory');
      if (fs.existsSync(memorySubDir)) {
        const memoryFiles = fs.readdirSync(memorySubDir)
          .filter(file => file.endsWith('.md'))
          .map(file => {
            const filePath = path.join(memorySubDir, file);
            const stats = fs.statSync(filePath);
            return {
              name: file,
              path: `memory/${file}`,
              size: stats.size,
              modified: stats.mtime.toISOString(),
              type: 'daily'
            };
          });
        
        // Sort daily files by date (newest first)
        memoryFiles.sort((a, b) => new Date(b.modified).getTime() - new Date(a.modified).getTime());
        files.push(...memoryFiles);
      }
      
      return NextResponse.json(files);
    }
    
    if (action === 'read') {
      const file = searchParams.get('file');
      if (!file) {
        return NextResponse.json({ error: 'File parameter required' }, { status: 400 });
      }
      
      const filePath = path.join(memoryDir, file);
      
      // Security check - ensure file is within memory directory
      const resolvedPath = path.resolve(filePath);
      const resolvedMemoryDir = path.resolve(memoryDir);
      if (!resolvedPath.startsWith(resolvedMemoryDir)) {
        return NextResponse.json({ error: 'Access denied' }, { status: 403 });
      }
      
      if (!fs.existsSync(filePath)) {
        return NextResponse.json({ error: 'File not found' }, { status: 404 });
      }
      
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);
      
      return NextResponse.json({
        content,
        size: stats.size,
        modified: stats.mtime.toISOString(),
      });
    }
    
    if (action === 'search') {
      const query = searchParams.get('q');
      if (!query || query.length < 2) {
        return NextResponse.json({ error: 'Query must be at least 2 characters' }, { status: 400 });
      }
      
      const results = [];
      const searchLower = query.toLowerCase();
      
      // Search main files
      const mainFiles = ['MEMORY.md', 'TOOLS.md', 'USER.md', 'SOUL.md', 'IDENTITY.md'];
      for (const filename of mainFiles) {
        const filePath = path.join(memoryDir, filename);
        if (fs.existsSync(filePath)) {
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchLower)) {
              results.push({
                file: filename,
                line: index + 1,
                content: line.trim(),
                context: lines.slice(Math.max(0, index - 1), index + 2).join('\n'),
              });
            }
          });
        }
      }
      
      // Search memory subdirectory
      const memorySubDir = path.join(memoryDir, 'memory');
      if (fs.existsSync(memorySubDir)) {
        const memoryFiles = fs.readdirSync(memorySubDir).filter(file => file.endsWith('.md'));
        
        for (const filename of memoryFiles) {
          const filePath = path.join(memorySubDir, filename);
          const content = fs.readFileSync(filePath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes(searchLower)) {
              results.push({
                file: `memory/${filename}`,
                line: index + 1,
                content: line.trim(),
                context: lines.slice(Math.max(0, index - 1), index + 2).join('\n'),
              });
            }
          });
        }
      }
      
      // Sort results by relevance (exact matches first, then by file type)
      results.sort((a, b) => {
        const aExact = a.content.toLowerCase().includes(searchLower);
        const bExact = b.content.toLowerCase().includes(searchLower);
        if (aExact && !bExact) return -1;
        if (!aExact && bExact) return 1;
        
        // Prioritize main files over daily files
        const aIsMain = !a.file.startsWith('memory/');
        const bIsMain = !b.file.startsWith('memory/');
        if (aIsMain && !bIsMain) return -1;
        if (!aIsMain && bIsMain) return 1;
        
        return 0;
      });
      
      return NextResponse.json({
        query,
        results: results.slice(0, 100), // Limit to 100 results
        total: results.length,
      });
    }
    
    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error) {
    console.error('Memory API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}