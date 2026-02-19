export type AgentStatus = 'online' | 'busy' | 'idle' | 'offline' | 'error';
export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
export type TaskPriority = 'critical' | 'high' | 'medium' | 'low';
export type ProviderType = 'kimi-k2.5' | 'claude' | 'openai' | 'openrouter' | 'custom';
export type MessageType = 'message' | 'mention' | 'system' | 'error' | 'heartbeat';

export interface Agent {
  id: string;
  name: string;
  codename: string;
  avatar: string;
  role: string;
  status: AgentStatus;
  personality: string;
  soul: string;
  provider: ProviderType;
  model: string;
  squadId: string | null;
  lastHeartbeat: string | null;
  tasksCompleted: number;
  tokensUsed: number;
  costUsd: number;
  currentTaskId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  assigneeId: string | null;
  assigneeName?: string;
  assigneeAvatar?: string;
  squadId: string | null;
  tags: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  estimatedTokens: number;
  actualTokens: number;
  /** Comma-separated list of task IDs this task depends on */
  dependsOn?: string;
  /** Accumulated context from parent tasks (set automatically) */
  chainContext?: string;
}

export interface Message {
  id: string;
  fromAgentId: string;
  fromAgentName?: string;
  fromAgentAvatar?: string;
  toAgentId: string | null;
  content: string;
  type: MessageType;
  createdAt: string;
  read: boolean;
}

export interface Squad {
  id: string;
  name: string;
  description: string;
  leadAgentId: string | null;
  agentIds: string[];
  createdAt: string;
  status: 'active' | 'paused' | 'disbanded';
}

export interface Heartbeat {
  id?: number;
  agentId: string;
  status: AgentStatus;
  timestamp: string;
  taskProgress: number;
  memoryUsage: number;
  tokensUsedSession: number;
}

export interface AnalyticsData {
  totalAgents: number;
  activeAgents: number;
  totalTasks: number;
  completedTasks: number;
  totalTokens: number;
  totalCost: number;
  tasksByStatus: Record<TaskStatus, number>;
  agentPerformance: Array<{
    agentId: string;
    name: string;
    codename: string;
    avatar: string;
    tasksCompleted: number;
    tokensUsed: number;
    costUsd: number;
  }>;
  activityTimeline: Array<{
    hour: string;
    tasks: number;
    messages: number;
  }>;
}

export interface ProviderConfig {
  type: ProviderType;
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  contextWindow: number;
  maxTokens: number;
}

export const DEFAULT_PROVIDERS: Record<string, Omit<ProviderConfig, 'apiKey'>> = {
  'kimi-k2.5': {
    type: 'kimi-k2.5',
    name: 'Kimi K2.5 (OpenRouter)',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'moonshotai/kimi-k2.5',
    contextWindow: 131072,
    maxTokens: 8192,
  },
  claude: {
    type: 'claude',
    name: 'Claude (Anthropic)',
    baseUrl: 'https://api.anthropic.com/v1',
    model: 'claude-sonnet-4-5-20250929',
    contextWindow: 200000,
    maxTokens: 8192,
  },
  openai: {
    type: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
    contextWindow: 128000,
    maxTokens: 4096,
  },
};

export interface TaskResult {
  id: string;
  taskId: string;
  agentId: string;
  agentName?: string;
  agentAvatar?: string;
  prompt: string;
  response: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  status: 'running' | 'completed' | 'error';
  createdAt: string;
}

export const TASK_STATUS_CONFIG: Record<TaskStatus, { label: string; color: string; bgColor: string }> = {
  backlog: { label: 'Backlog', color: 'text-slate-400', bgColor: 'bg-slate-500/20' },
  todo: { label: 'To Do', color: 'text-blue-400', bgColor: 'bg-blue-500/20' },
  in_progress: { label: 'In Progress', color: 'text-amber-400', bgColor: 'bg-amber-500/20' },
  review: { label: 'Review', color: 'text-purple-400', bgColor: 'bg-purple-500/20' },
  done: { label: 'Done', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20' },
};

export const AGENT_STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; pulse: boolean }> = {
  online: { label: 'Online', color: 'bg-emerald-500', pulse: true },
  busy: { label: 'Busy', color: 'bg-amber-500', pulse: true },
  idle: { label: 'Idle', color: 'bg-blue-400', pulse: false },
  offline: { label: 'Offline', color: 'bg-slate-500', pulse: false },
  error: { label: 'Error', color: 'bg-red-500', pulse: true },
};

export const PRIORITY_CONFIG: Record<TaskPriority, { label: string; color: string; icon: string }> = {
  critical: { label: 'Critical', color: 'text-red-400', icon: '🔴' },
  high: { label: 'High', color: 'text-orange-400', icon: '🟠' },
  medium: { label: 'Medium', color: 'text-yellow-400', icon: '🟡' },
  low: { label: 'Low', color: 'text-blue-400', icon: '🔵' },
};
