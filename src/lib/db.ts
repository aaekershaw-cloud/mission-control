import Database from 'better-sqlite3';
import path from 'path';
import { v4 as uuid } from 'uuid';

const DB_PATH = path.join(process.cwd(), 'mission-control.db');

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    db.pragma('foreign_keys = ON');
    initializeDatabase(db);
  }
  return db;
}

function initializeDatabase(db: Database.Database) {
  db.exec(`
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
      last_heartbeat TEXT,
      tasks_completed INTEGER DEFAULT 0,
      tokens_used INTEGER DEFAULT 0,
      cost_usd REAL DEFAULT 0,
      current_task_id TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      status TEXT DEFAULT 'backlog',
      priority TEXT DEFAULT 'medium',
      assignee_id TEXT,
      squad_id TEXT,
      tags TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      completed_at TEXT,
      estimated_tokens INTEGER DEFAULT 0,
      actual_tokens INTEGER DEFAULT 0,
      FOREIGN KEY (assignee_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      from_agent_id TEXT NOT NULL,
      to_agent_id TEXT,
      content TEXT NOT NULL,
      type TEXT DEFAULT 'message',
      created_at TEXT DEFAULT (datetime('now')),
      read INTEGER DEFAULT 0,
      FOREIGN KEY (from_agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS squads (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT DEFAULT '',
      lead_agent_id TEXT,
      agent_ids TEXT DEFAULT '[]',
      created_at TEXT DEFAULT (datetime('now')),
      status TEXT DEFAULT 'active',
      FOREIGN KEY (lead_agent_id) REFERENCES agents(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS heartbeats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      agent_id TEXT NOT NULL,
      status TEXT NOT NULL,
      timestamp TEXT DEFAULT (datetime('now')),
      task_progress REAL DEFAULT 0,
      memory_usage REAL DEFAULT 0,
      tokens_used_session INTEGER DEFAULT 0,
      FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS provider_configs (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      name TEXT NOT NULL,
      base_url TEXT NOT NULL,
      api_key TEXT DEFAULT '',
      model TEXT NOT NULL,
      context_window INTEGER DEFAULT 131072,
      max_tokens INTEGER DEFAULT 8192,
      is_default INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);

  // Seed default provider if none exist
  const providerCount = db.prepare('SELECT COUNT(*) as count FROM provider_configs').get() as { count: number };
  if (providerCount.count === 0) {
    db.prepare(`
      INSERT INTO provider_configs (id, type, name, base_url, model, context_window, max_tokens, is_default)
      VALUES (?, 'kimi-k2.5', 'Kimi K2.5 (OpenRouter)', 'https://openrouter.ai/api/v1', 'moonshotai/kimi-k2.5', 131072, 8192, 1)
    `).run(uuid());
  }

  // Seed demo data if no agents exist
  const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
  if (agentCount.count === 0) {
    seedDemoData(db);
  }
}

function seedDemoData(db: Database.Database) {
  const squadId = uuid();

  // Create a demo squad
  db.prepare(`
    INSERT INTO squads (id, name, description, status)
    VALUES (?, 'Alpha Squad', 'Primary development team - full-stack feature delivery', 'active')
  `).run(squadId);

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
    {
      id: uuid(),
      name: 'Nova',
      codename: 'NOVA',
      avatar: '⚡',
      role: 'Frontend Engineer',
      status: 'busy',
      personality: 'Creative, detail-oriented, passionate about UX. Loves clean code and smooth animations.',
      soul: '# NOVA - Frontend Engineer\\n\\nYou specialize in:\\n- React/Next.js components\\n- CSS and animations\\n- Responsive design\\n- Accessibility\\n- User experience optimization',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
    {
      id: uuid(),
      name: 'Forge',
      codename: 'FORGE',
      avatar: '🔧',
      role: 'Backend Engineer',
      status: 'online',
      personality: 'Methodical, security-conscious, performance-focused. Builds robust APIs and data pipelines.',
      soul: '# FORGE - Backend Engineer\\n\\nYou specialize in:\\n- API design and implementation\\n- Database architecture\\n- Security best practices\\n- Performance optimization\\n- System integration',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
    {
      id: uuid(),
      name: 'Aegis',
      codename: 'AEGIS',
      avatar: '🛡️',
      role: 'Code Reviewer / QA',
      status: 'idle',
      personality: 'Thorough, opinionated (in a good way), catches edge cases. Pro-Oxford comma, anti-spaghetti code.',
      soul: '# AEGIS - Code Reviewer\\n\\nYou specialize in:\\n- Code review and quality assurance\\n- Testing strategies\\n- Bug detection\\n- Best practices enforcement\\n- Documentation review',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
    {
      id: uuid(),
      name: 'Scout',
      codename: 'SCOUT',
      avatar: '🔍',
      role: 'Research & Analysis',
      status: 'online',
      personality: 'Curious, thorough, provides receipts for every claim. Great at competitive analysis and technical research.',
      soul: '# SCOUT - Researcher\\n\\nYou specialize in:\\n- Technical research and analysis\\n- Documentation and knowledge bases\\n- Competitive analysis\\n- Best practices discovery\\n- Architecture recommendations',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
    {
      id: uuid(),
      name: 'Pixel',
      codename: 'PIXEL',
      avatar: '🎨',
      role: 'UI/UX Designer',
      status: 'idle',
      personality: 'Visual thinker, trend-aware, obsessed with pixel-perfect design. Thinks in hooks and engagement.',
      soul: '# PIXEL - UI/UX Designer\\n\\nYou specialize in:\\n- Visual design systems\\n- User interface patterns\\n- Color theory and typography\\n- Interaction design\\n- Design system maintenance',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
    {
      id: uuid(),
      name: 'Sentinel',
      codename: 'SENTINEL',
      avatar: '🔒',
      role: 'Security Specialist',
      status: 'offline',
      personality: 'Paranoid (in the best way), always thinking about attack vectors. Questions assumptions and looks for what could break.',
      soul: '# SENTINEL - Security Specialist\\n\\nYou specialize in:\\n- Security auditing\\n- Vulnerability assessment\\n- Authentication/authorization\\n- Data protection\\n- Threat modeling',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
    {
      id: uuid(),
      name: 'Atlas',
      codename: 'ATLAS',
      avatar: '🗺️',
      role: 'DevOps / Infrastructure',
      status: 'online',
      personality: 'Infrastructure-minded, automation-obsessed, loves CI/CD pipelines. Makes deployment a breeze.',
      soul: '# ATLAS - DevOps Engineer\\n\\nYou specialize in:\\n- CI/CD pipelines\\n- Infrastructure as code\\n- Deployment automation\\n- Monitoring and alerting\\n- Container orchestration',
      provider: 'kimi-k2.5',
      model: 'moonshotai/kimi-k2.5',
    },
  ];

  const insertAgent = db.prepare(`
    INSERT INTO agents (id, name, codename, avatar, role, status, personality, soul, provider, model, squad_id, last_heartbeat, tasks_completed, tokens_used, cost_usd)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' minutes'), ?, ?, ?)
  `);

  const agentIds: string[] = [];
  for (const agent of agents) {
    const minutesAgo = Math.floor(Math.random() * 30);
    const tasksCompleted = Math.floor(Math.random() * 50) + 5;
    const tokensUsed = Math.floor(Math.random() * 500000) + 50000;
    const costUsd = parseFloat((tokensUsed * 0.000002).toFixed(4));
    insertAgent.run(
      agent.id, agent.name, agent.codename, agent.avatar, agent.role,
      agent.status, agent.personality, agent.soul, agent.provider, agent.model,
      squadId, minutesAgo.toString(), tasksCompleted, tokensUsed, costUsd
    );
    agentIds.push(agent.id);
  }

  // Update squad with agent IDs and lead
  db.prepare('UPDATE squads SET agent_ids = ?, lead_agent_id = ? WHERE id = ?')
    .run(JSON.stringify(agentIds), agentIds[0], squadId);

  // Create demo tasks
  const tasks = [
    { title: 'Implement user authentication flow', status: 'done', priority: 'critical', assignee: 2, tags: ['auth', 'security'] },
    { title: 'Design dashboard layout components', status: 'done', priority: 'high', assignee: 5, tags: ['ui', 'design'] },
    { title: 'Build REST API for agent management', status: 'in_progress', priority: 'high', assignee: 2, tags: ['api', 'backend'] },
    { title: 'Create real-time WebSocket handler', status: 'in_progress', priority: 'high', assignee: 2, tags: ['websocket', 'realtime'] },
    { title: 'Implement task kanban board', status: 'in_progress', priority: 'medium', assignee: 1, tags: ['ui', 'tasks'] },
    { title: 'Set up CI/CD pipeline', status: 'review', priority: 'medium', assignee: 7, tags: ['devops', 'ci'] },
    { title: 'Add rate limiting to API endpoints', status: 'todo', priority: 'high', assignee: 6, tags: ['security', 'api'] },
    { title: 'Write integration tests for agent API', status: 'todo', priority: 'medium', assignee: 3, tags: ['testing', 'api'] },
    { title: 'Implement dark mode toggle', status: 'todo', priority: 'low', assignee: 1, tags: ['ui', 'theme'] },
    { title: 'Add OpenRouter provider integration', status: 'backlog', priority: 'high', assignee: null, tags: ['integration', 'provider'] },
    { title: 'Build agent performance analytics', status: 'backlog', priority: 'medium', assignee: null, tags: ['analytics', 'dashboard'] },
    { title: 'Create squad configuration wizard', status: 'backlog', priority: 'medium', assignee: null, tags: ['ui', 'squads'] },
    { title: 'Implement agent-to-agent messaging', status: 'backlog', priority: 'high', assignee: null, tags: ['messaging', 'agents'] },
    { title: 'Add token usage tracking & alerts', status: 'backlog', priority: 'medium', assignee: null, tags: ['monitoring', 'costs'] },
  ];

  const insertTask = db.prepare(`
    INSERT INTO tasks (id, title, status, priority, assignee_id, squad_id, tags, created_at, completed_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now', '-' || ? || ' hours'), ?)
  `);

  for (const task of tasks) {
    const hoursAgo = Math.floor(Math.random() * 72) + 1;
    const assigneeId = task.assignee !== null ? agentIds[task.assignee] : null;
    const completedAt = task.status === 'done' ? new Date().toISOString() : null;
    insertTask.run(uuid(), task.title, task.status, task.priority, assigneeId, squadId, JSON.stringify(task.tags), hoursAgo.toString(), completedAt);
  }

  // Create demo messages
  const messages = [
    { from: 0, to: null, content: 'Good morning team. Sprint 4 is underway. Nova, how\'s the dashboard layout coming along?', type: 'message' },
    { from: 1, to: 0, content: 'Dashboard components are 80% done. Working on the responsive grid now. Should be ready for review by EOD.', type: 'message' },
    { from: 2, to: null, content: 'API endpoints for agent CRUD are live. @Aegis ready for your review when you get a chance.', type: 'mention' },
    { from: 3, to: 2, content: 'Looking at the agent endpoints now. Found a couple edge cases with the status transitions - sending detailed feedback.', type: 'message' },
    { from: 4, to: null, content: 'Research complete on WebSocket vs SSE for real-time updates. Recommending SSE for our use case - simpler, sufficient for our needs.', type: 'message' },
    { from: 6, to: 0, content: 'Security audit of the auth flow is complete. Found 2 medium-severity issues. Creating tasks now.', type: 'message' },
    { from: 7, to: null, content: 'CI/CD pipeline is configured. PRs will now auto-run lint + test. Deploy to staging on merge to main.', type: 'system' },
    { from: 0, to: null, content: 'Great progress everyone. Let\'s sync at 2pm to review the sprint board.', type: 'message' },
    { from: 5, to: 1, content: 'Here\'s the updated color palette for the glassmorphism cards. Using deeper blues with 12% opacity for the glass effect.', type: 'message' },
    { from: 1, to: 5, content: 'Love it! The gradient on the sidebar looks perfect. Implementing now.', type: 'message' },
  ];

  const insertMessage = db.prepare(`
    INSERT INTO messages (id, from_agent_id, to_agent_id, content, type, created_at)
    VALUES (?, ?, ?, ?, ?, datetime('now', '-' || ? || ' minutes'))
  `);

  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i];
    const minutesAgo = (messages.length - i) * 15;
    insertMessage.run(
      uuid(),
      agentIds[msg.from],
      msg.to !== null ? agentIds[msg.to] : null,
      msg.content,
      msg.type,
      minutesAgo.toString()
    );
  }

  // Create demo heartbeats
  const insertHeartbeat = db.prepare(`
    INSERT INTO heartbeats (agent_id, status, timestamp, task_progress, memory_usage, tokens_used_session)
    VALUES (?, ?, datetime('now', '-' || ? || ' minutes'), ?, ?, ?)
  `);

  for (const agentId of agentIds) {
    for (let i = 0; i < 10; i++) {
      insertHeartbeat.run(
        agentId,
        ['online', 'busy', 'idle'][Math.floor(Math.random() * 3)],
        (i * 5).toString(),
        Math.random() * 100,
        30 + Math.random() * 50,
        Math.floor(Math.random() * 10000)
      );
    }
  }
}
