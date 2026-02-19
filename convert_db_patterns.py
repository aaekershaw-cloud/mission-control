#!/usr/bin/env python3
import os
import re
import glob

def convert_file(filepath):
    """Convert a single TypeScript file from SQLite patterns to PostgreSQL patterns"""
    print(f"Converting {filepath}")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Replace db.prepare(...).get(...) patterns
    content = re.sub(
        r'db\.prepare\s*\(\s*([`\'"])(.*?)\1\s*\)\.get\s*\((.*?)\)',
        r'await db.get(\1\2\1, [\3])',
        content
    )
    
    # Replace db.prepare(...).all(...) patterns
    content = re.sub(
        r'db\.prepare\s*\(\s*([`\'"])(.*?)\1\s*\)\.all\s*\((.*?)\)',
        r'await db.all(\1\2\1, [\3])',
        content
    )
    
    # Replace db.prepare(...).run(...) patterns
    content = re.sub(
        r'db\.prepare\s*\(\s*([`\'"])(.*?)\1\s*\)\.run\s*\((.*?)\)',
        r'await db.run(\1\2\1, [\3])',
        content
    )
    
    # Replace ? with $1, $2, $3 etc in SQL queries
    def replace_placeholders(match):
        query = match.group(2)
        params_count = query.count('?')
        for i in range(params_count, 0, -1):
            query = query.replace('?', f'${i}', 1)
        return match.group(1) + query + match.group(3)
    
    content = re.sub(r'([`\'"])([^`\'"]*\?[^`\'"]*)\1', replace_placeholders, content)
    
    # Replace datetime('now') with NOW()
    content = content.replace("datetime('now')", "NOW()")
    
    # Replace is_default = 1 with is_default = true
    content = re.sub(r'is_default\s*=\s*1\b', 'is_default = true', content)
    content = re.sub(r'is_default\s*=\s*0\b', 'is_default = false', content)
    
    # Replace read = 1 with read = true
    content = re.sub(r'\bread\s*=\s*1\b', 'read = true', content)
    content = re.sub(r'\bread\s*=\s*0\b', 'read = false', content)
    
    # Replace JSON.parse calls on JSONB columns (tags, agent_ids, reasons, checks)
    content = re.sub(
        r'JSON\.parse\s*\(\s*([^)]*?\.(?:tags|agent_ids|reasons|checks))\s*\|\|\s*[\'"][^\'"]*[\'"]\s*\)',
        r'\1 || []',
        content
    )
    
    # Make functions async if they contain await
    if 'await db.' in content:
        # Find function declarations and add async if not already present
        content = re.sub(
            r'(export\s+(?:async\s+)?function\s+\w+\s*\([^)]*\))\s*:\s*([^{]+)\s*{',
            lambda m: m.group(1).replace('function', 'async function') + f': Promise<{m.group(2).strip()}> {{' if 'Promise' not in m.group(2) else m.group(0),
            content
        )
        
        # Find arrow functions
        content = re.sub(
            r'(\w+\s*:\s*)(\([^)]*\)\s*=>\s*{)',
            r'\1async \2',
            content
        )
    
    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  ✓ Converted {filepath}")
    else:
        print(f"  - No changes needed for {filepath}")

def main():
    os.chdir('/Users/andrewkershaw/mission-control')
    
    # List of files to convert
    files_to_convert = [
        'src/app/api/squads/[id]/route.ts',
        'src/app/api/heartbeat/route.ts',
        'src/app/api/heartbeat/trigger/route.ts', 
        'src/app/api/heartbeat/cron/route.ts',
        'src/app/api/export/route.ts',
        'src/app/api/produce/route.ts',
        'src/app/api/produce/auto/route.ts',
        'src/app/api/execute/[taskId]/route.ts',
        'src/app/api/execute/history/route.ts',
        'src/app/api/tasks/bulk/route.ts',
        'src/app/api/tasks/[id]/auto-review/route.ts',
        'src/app/api/tasks/[id]/review/route.ts',
        'src/app/api/messages/[id]/route.ts',
        'src/app/api/agents/[id]/tasks/route.ts',
        'src/app/api/agents/[id]/test/route.ts',
        'src/app/api/search/route.ts',
        'src/app/api/social/route.ts',
        'src/app/api/analytics/route.ts'
    ]
    
    for filepath in files_to_convert:
        if os.path.exists(filepath):
            convert_file(filepath)
        else:
            print(f"File not found: {filepath}")

if __name__ == '__main__':
    main()