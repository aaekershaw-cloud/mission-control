#!/usr/bin/env python3
import os
import re

def convert_file(filepath):
    """Convert a single TypeScript file from SQLite patterns to PostgreSQL patterns"""
    print(f"Converting {filepath}")
    
    with open(filepath, 'r') as f:
        content = f.read()
    
    original_content = content
    
    # Simple replacements first
    content = content.replace("datetime('now')", "NOW()")
    content = content.replace("is_default = 1", "is_default = true")
    content = content.replace("is_default = 0", "is_default = false")
    content = content.replace("read = 1", "read = true")  
    content = content.replace("read = 0", "read = false")
    
    # Replace common JSON.parse patterns for JSONB columns
    content = re.sub(r'JSON\.parse\s*\(\s*([^)]*?\.tags)\s*\|\|\s*[\'"][^\'"]*[\'"]\s*\)', r'\1 || []', content)
    content = re.sub(r'JSON\.parse\s*\(\s*([^)]*?\.agent_ids)\s*\|\|\s*[\'"][^\'"]*[\'"]\s*\)', r'\1 || []', content)
    
    # Only write if content changed
    if content != original_content:
        with open(filepath, 'w') as f:
            f.write(content)
        print(f"  ✓ Updated {filepath}")
    else:
        print(f"  - No changes needed for {filepath}")

# Convert files one by one manually
files = [
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

os.chdir('/Users/andrewkershaw/mission-control')
for f in files:
    if os.path.exists(f):
        convert_file(f)