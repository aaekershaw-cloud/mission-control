-- PostgreSQL schema for Mission Control
-- Converted from SQLite to PostgreSQL syntax

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  codename TEXT NOT NULL,
  avatar TEXT DEFAULT '🤖',
  role TEXT NOT NULL,
  status TEXT DEFAULT 'offline',
  personality TEXT DEFAULT '',
  soul TEXT DEFAULT '',
  provider TEXT DEFAULT 'kimi-k2.5',
  model TEXT DEFAULT 'moonshotai/kimi-k2.5',
  squad_id TEXT,
  last_heartbeat TIMESTAMP,
  tasks_completed INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  current_task_id TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'backlog',
  priority TEXT DEFAULT 'medium',
  assignee_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  squad_id TEXT,
  tags JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP,
  estimated_tokens INTEGER DEFAULT 0,
  actual_tokens INTEGER DEFAULT 0,
  depends_on TEXT DEFAULT '',
  chain_context TEXT DEFAULT '',
  retry_count INTEGER DEFAULT 0
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  from_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  to_agent_id TEXT,
  content TEXT NOT NULL,
  type TEXT DEFAULT 'message',
  created_at TIMESTAMP DEFAULT NOW(),
  read BOOLEAN DEFAULT FALSE
);

CREATE TABLE squads (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  lead_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
  agent_ids JSONB DEFAULT '[]',
  created_at TIMESTAMP DEFAULT NOW(),
  status TEXT DEFAULT 'active'
);

CREATE TABLE heartbeats (
  id SERIAL PRIMARY KEY,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  timestamp TIMESTAMP DEFAULT NOW(),
  task_progress REAL DEFAULT 0,
  memory_usage REAL DEFAULT 0,
  tokens_used_session INTEGER DEFAULT 0
);

CREATE TABLE provider_configs (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  name TEXT NOT NULL,
  base_url TEXT NOT NULL,
  api_key TEXT DEFAULT '',
  model TEXT NOT NULL,
  context_window INTEGER DEFAULT 131072,
  max_tokens INTEGER DEFAULT 8192,
  is_default BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE task_results (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  prompt TEXT NOT NULL,
  response TEXT NOT NULL,
  tokens_used INTEGER DEFAULT 0,
  cost_usd REAL DEFAULT 0,
  duration_ms INTEGER DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE queue_state (
  id TEXT PRIMARY KEY DEFAULT 'singleton',
  status TEXT DEFAULT 'idle',
  current_task_id TEXT,
  tasks_processed INTEGER DEFAULT 0,
  tasks_remaining INTEGER DEFAULT 0,
  started_at TIMESTAMP,
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE auto_reviews (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES tasks(id),
  decision TEXT NOT NULL,
  reasons JSONB NOT NULL,
  checks JSONB NOT NULL,
  repaired_content TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);