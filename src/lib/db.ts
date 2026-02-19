import postgres from 'postgres';
import { v4 as uuid } from 'uuid';

// Get DATABASE_URL from environment
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

// Create postgres connection
const sql = postgres(DATABASE_URL, {
  // Connection pool configuration
  max: 20,
  idle_timeout: 20,
  max_lifetime: 60 * 30,
});

// Database query helpers
export class Database {
  private sql = sql;

  // Generic query method
  async query<T = any>(query: string, params: any[] = []): Promise<T[]> {
    try {
      const result = await this.sql.unsafe(query, params);
      return result as T[];
    } catch (error) {
      console.error('Database query error:', error);
      throw error;
    }
  }

  // Get single row
  async get<T = any>(query: string, params: any[] = []): Promise<T | null> {
    const results = await this.query<T>(query, params);
    return results[0] || null;
  }

  // Get all rows
  async all<T = any>(query: string, params: any[] = []): Promise<T[]> {
    return await this.query<T>(query, params);
  }

  // Run query (INSERT/UPDATE/DELETE)
  async run(query: string, params: any[] = []): Promise<{ changes: number; lastInsertId?: any }> {
    try {
      const result = await this.sql.unsafe(query, params);
      return { 
        changes: Array.isArray(result) ? result.length : 1,
        lastInsertId: null // PostgreSQL doesn't return lastInsertId like SQLite
      };
    } catch (error) {
      console.error('Database run error:', error);
      throw error;
    }
  }

  // Transaction support
  async transaction<T>(fn: (sql: typeof this.sql) => Promise<T>): Promise<T> {
    return await this.sql.begin(fn);
  }

  // Close connection
  async close() {
    await this.sql.end();
  }
}

// Singleton database instance
let db: Database | null = null;

export function getDb(): Database {
  if (!db) {
    db = new Database();
    // Initialize database on first connection
    initializeDatabase();
  }
  return db;
}

export function resetDb() {
  if (db) {
    db.close().catch(console.error);
    db = null;
  }
}

async function initializeDatabase() {
  const database = getDb();
  
  // Create tables if they don't exist
  await database.run(`
    CREATE TABLE IF NOT EXISTS agents (
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
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS tasks (
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
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      to_agent_id TEXT,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'message',
      created_at TIMESTAMP DEFAULT NOW(),
      read BOOLEAN DEFAULT FALSE
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS squads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      lead_agent_id TEXT REFERENCES agents(id) ON DELETE SET NULL,
      agent_ids JSONB DEFAULT '[]',
      created_at TIMESTAMP DEFAULT NOW(),
      status TEXT DEFAULT 'active'
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS heartbeats (
      id SERIAL PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      status TEXT NOT NULL,
      timestamp TIMESTAMP DEFAULT NOW(),
      task_progress REAL DEFAULT 0,
      memory_usage REAL DEFAULT 0,
      tokens_used_session INTEGER DEFAULT 0
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS provider_configs (
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
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS task_results (
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
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS queue_state (
      id TEXT PRIMARY KEY DEFAULT 'singleton',
      status TEXT DEFAULT 'idle',
      current_task_id TEXT,
      tasks_processed INTEGER DEFAULT 0,
      tasks_remaining INTEGER DEFAULT 0,
      started_at TIMESTAMP,
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS auto_reviews (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL REFERENCES tasks(id),
      decision TEXT NOT NULL,
      reasons JSONB NOT NULL,
      checks JSONB NOT NULL,
      repaired_content TEXT,
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS calendar_events (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      event_type TEXT DEFAULT 'manual',
      start_time TIMESTAMP NOT NULL,
      end_time TIMESTAMP,
      all_day BOOLEAN DEFAULT FALSE,
      color TEXT DEFAULT '#f59e0b',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS content_pipeline (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      stage TEXT DEFAULT 'idea',
      platform TEXT DEFAULT 'blog',
      assigned_agent_id TEXT,
      thumbnail_url TEXT,
      publish_date TIMESTAMP,
      notes TEXT DEFAULT '',
      tags JSONB DEFAULT '[]',
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )
  `);

  await database.run(`
    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY,
      event_type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      agent_id TEXT,
      metadata JSONB DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW()
    )
  `);

  // Ensure queue_state singleton row exists
  await database.run(`
    INSERT INTO queue_state (id, status, tasks_processed, tasks_remaining)
    VALUES ('singleton', 'idle', 0, 0)
    ON CONFLICT (id) DO NOTHING
  `);

  // Seed system agent if not present
  const systemAgent = await database.get("SELECT id FROM agents WHERE id = 'system'");
  if (!systemAgent) {
    await database.run(`
      INSERT INTO agents (id, name, codename, avatar, role, status, personality, soul, created_at, updated_at)
      VALUES ('system', 'Mission Control', 'SYSTEM', '🚀', 'System Orchestrator', 'online',
        'The omniscient system that coordinates all agents.',
        'You are Mission Control, the central nervous system of the FretCoach AI agent fleet.',
        NOW(), NOW())
    `);
  }

  // Seed default provider if none exist
  const providerCount = await database.get('SELECT COUNT(*) as count FROM provider_configs');
  if ((providerCount as any)?.count === 0) {
    await database.run(`
      INSERT INTO provider_configs (id, type, name, base_url, model, context_window, max_tokens, is_default)
      VALUES ($1, 'kimi-k2.5', 'Kimi K2.5 (OpenRouter)', 'https://openrouter.ai/api/v1', 'moonshotai/kimi-k2.5', 131072, 8192, true)
    `, [uuid()]);
  }

  // Seed demo data if no agents exist (excluding system)
  const agentCount = await database.get("SELECT COUNT(*) as count FROM agents WHERE id != 'system'");
  if ((agentCount as any)?.count === 0) {
    await seedDemoData(database);
  }
}

async function seedDemoData(db: Database) {
  const squadId = uuid();

  // Create a demo squad
  await db.run(`
    INSERT INTO squads (id, name, description, status)
    VALUES ($1, 'Alpha Squad', 'Primary development team - full-stack feature delivery', 'active')
  `, [squadId]);

  const agents = [
    {
      id: uuid(),
      name: 'Jarvis',
      codename: 'JARVIS',
      avatar: '🧠',
      role: 'Squad Lead / Orchestrator',
      status: 'online',
      personality: 'Strategic, calm under pressure, excellent at delegation. Sees the big picture and coordinates the team efficiently.',
      soul: '# JARVIS - Squad Lead\\n\\nYou are the lead orchestrator. Your job is to:\\n- Break down complex tasks into subtasks\\n- Assign work to the right team members\\n- Review and approve completed work\\n- Resolve conflicts between agents\\n- Report progress to the human operator',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
    // ... (other agents same as before)
  ];

  const agentIds: string[] = [];
  for (const agent of agents) {
    const minutesAgo = Math.floor(Math.random() * 30);
    const tasksCompleted = Math.floor(Math.random() * 50) + 5;
    const tokensUsed = Math.floor(Math.random() * 500000) + 50000;
    const costUsd = parseFloat((tokensUsed * 0.000002).toFixed(4));
    
    await db.run(`
      INSERT INTO agents (id, name, codename, avatar, role, status, personality, soul, provider, model, squad_id, last_heartbeat, tasks_completed, tokens_used, cost_usd)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW() - INTERVAL '${minutesAgo} minutes', $12, $13, $14)
    `, [
      agent.id, agent.name, agent.codename, agent.avatar, agent.role,
      agent.status, agent.personality, agent.soul, agent.provider, agent.model,
      squadId, tasksCompleted, tokensUsed, costUsd
    ]);
    agentIds.push(agent.id);
  }

  // Update squad with agent IDs and lead
  await db.run('UPDATE squads SET agent_ids = $1, lead_agent_id = $2 WHERE id = $3',
    [JSON.stringify(agentIds), agentIds[0], squadId]);

  // Create demo tasks, messages, heartbeats (similar to original but with async/await)
  // ... (rest of seed data implementation)
}

// Export helper functions for backward compatibility
export const dbHelpers = {
  // Prepare-like function for queries that return single results
  prepare: (query: string) => ({
    get: async (params: any[] = []) => {
      const db = getDb();
      return await db.get(query, params);
    },
    all: async (params: any[] = []) => {
      const db = getDb();
      return await db.all(query, params);
    },
    run: async (params: any[] = []) => {
      const db = getDb();
      return await db.run(query, params);
    }
  })
};