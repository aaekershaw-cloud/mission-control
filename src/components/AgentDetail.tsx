'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Edit3,
  Save,
  Clock,
  Zap,
  Coins,
  CheckCircle2,
  Cpu,
  Trash2,
  AlertTriangle,
  Wifi,
  WifiOff,
  Loader,
  Send,
  History,
  FlaskConical,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { Agent, AgentStatus } from '@/types';
import StatusBadge from './StatusBadge';

interface AgentTaskHistory {
  id: string;
  title: string;
  status: string;
  priority: string;
  createdAt: string;
  result: {
    response: string;
    tokensUsed: number;
    costUsd: number;
    durationMs: number;
    status: string;
  } | null;
}

interface AgentDetailProps {
  agent: Agent;
  onClose: () => void;
  onUpdate: (agent: Partial<Agent> & { id: string }) => void;
  onDelete?: (agentId: string) => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const providerColors: Record<string, string> = {
  openrouter: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/20',
  'kimi-k2.5': 'bg-orange-500/15 text-orange-400 border-orange-500/20',
  claude: 'bg-purple-500/15 text-purple-400 border-purple-500/20',
  openai: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  custom: 'bg-slate-500/15 text-slate-400 border-slate-500/20',
};

const statusButtons: { status: AgentStatus; icon: typeof Wifi; label: string }[] = [
  { status: 'online', icon: Wifi, label: 'Online' },
  { status: 'busy', icon: Loader, label: 'Busy' },
  { status: 'offline', icon: WifiOff, label: 'Offline' },
];

const statusButtonColors: Record<AgentStatus, string> = {
  online: 'text-emerald-400 hover:bg-emerald-500/15 border-emerald-500/30',
  busy: 'text-amber-400 hover:bg-amber-500/15 border-amber-500/30',
  idle: 'text-blue-400 hover:bg-blue-500/15 border-blue-500/30',
  offline: 'text-slate-400 hover:bg-slate-500/15 border-slate-500/30',
  error: 'text-red-400 hover:bg-red-500/15 border-red-500/30',
};

export default function AgentDetail({ agent, onClose, onUpdate, onDelete }: AgentDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [activeSection, setActiveSection] = useState<'info' | 'history' | 'test'>('info');

  // Editable fields
  const [name, setName] = useState(agent.name);
  const [codename, setCodename] = useState(agent.codename);
  const [avatar, setAvatar] = useState(agent.avatar);
  const [role, setRole] = useState(agent.role);
  const [personality, setPersonality] = useState(agent.personality || '');
  const [soulContent, setSoulContent] = useState(agent.soul || '');

  // Task history
  const [taskHistory, setTaskHistory] = useState<AgentTaskHistory[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [expandedTask, setExpandedTask] = useState<string | null>(null);

  // Quick test
  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [testLoading, setTestLoading] = useState(false);
  const [testStats, setTestStats] = useState<{ tokensUsed: number; durationMs: number } | null>(null);

  useEffect(() => {
    setName(agent.name);
    setCodename(agent.codename);
    setAvatar(agent.avatar);
    setRole(agent.role);
    setPersonality(agent.personality || '');
    setSoulContent(agent.soul || '');
    setIsEditing(false);
    setConfirmDelete(false);
    setActiveSection('info');
    setTaskHistory([]);
    setTestResponse('');
    setTestStats(null);
  }, [agent]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  useEffect(() => {
    if (activeSection === 'history' && taskHistory.length === 0) {
      loadTaskHistory();
    }
  }, [activeSection]);

  async function loadTaskHistory() {
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/agents/${agent.id}/tasks`);
      if (res.ok) {
        const data = await res.json();
        setTaskHistory(data);
      }
    } catch (err) {
      console.error('Failed to load task history:', err);
    } finally {
      setHistoryLoading(false);
    }
  }

  async function handleTest() {
    if (!testPrompt.trim() || testLoading) return;
    setTestLoading(true);
    setTestResponse('');
    setTestStats(null);
    try {
      const res = await fetch(`/api/agents/${agent.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: testPrompt }),
      });
      const data = await res.json();
      if (data.error) {
        setTestResponse(`Error: ${data.error}`);
      } else {
        setTestResponse(data.response);
        setTestStats({ tokensUsed: data.tokensUsed, durationMs: data.durationMs });
      }
    } catch (err) {
      setTestResponse('Failed to execute test');
    } finally {
      setTestLoading(false);
    }
  }

  function handleSave() {
    onUpdate({
      id: agent.id,
      name: name.trim(),
      codename: codename.trim(),
      avatar,
      role: role.trim(),
      personality: personality.trim(),
      soul: soulContent,
    });
    setIsEditing(false);
  }

  function handleStatusChange(status: AgentStatus) {
    onUpdate({ id: agent.id, status });
  }

  function handleDelete() {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete?.(agent.id);
  }

  const statusColor: Record<string, string> = {
    done: 'text-emerald-400',
    review: 'text-purple-400',
    in_progress: 'text-amber-400',
    todo: 'text-blue-400',
    backlog: 'text-slate-400',
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 modal-overlay z-[60] flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="glass gradient-border w-full max-w-2xl max-h-[85vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-start justify-between p-6 border-b border-white/5 sticky top-0 z-10 bg-[#0d1117]/95 backdrop-blur-sm">
            <div className="flex items-center gap-4">
              {isEditing ? (
                <input
                  type="text"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  className="text-5xl w-16 h-16 text-center glass-sm outline-none focus:border-emerald-500/30"
                />
              ) : (
                <div className="text-5xl">{agent.avatar}</div>
              )}
              <div>
                {isEditing ? (
                  <div className="space-y-1.5">
                    <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                      className="glass-sm px-2 py-1 text-lg font-bold text-slate-100 outline-none focus:border-emerald-500/30 transition-colors w-full" placeholder="Agent name" />
                    <input type="text" value={codename} onChange={(e) => setCodename(e.target.value)}
                      className="glass-sm px-2 py-1 text-sm text-slate-500 font-mono outline-none focus:border-emerald-500/30 transition-colors w-full" placeholder="CODENAME" />
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-slate-100">{agent.name}</h2>
                    <p className="text-sm text-slate-500 font-mono">@{agent.codename}</p>
                  </>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={agent.status} size="sm" />
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-white/5 transition-all"
                title={isEditing ? 'Save changes' : 'Edit agent'}>
                {isEditing ? <Save size={18} /> : <Edit3 size={18} />}
              </button>
              <button onClick={onClose} className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all">
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Status Toggles */}
          <div className="px-6 pt-4">
            <div className="flex items-center gap-2">
              {statusButtons.map(({ status, icon: Icon, label }) => (
                <button key={status} onClick={() => handleStatusChange(status)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    agent.status === status ? `${statusButtonColors[status]} bg-white/5` : 'text-slate-500 border-transparent hover:border-white/10'
                  }`}>
                  <Icon size={12} />{label}
                </button>
              ))}
            </div>
          </div>

          {/* Section tabs */}
          <div className="px-6 pt-4 flex gap-2">
            {[
              { id: 'info' as const, label: 'Info', icon: Cpu },
              { id: 'history' as const, label: 'Task History', icon: History },
              { id: 'test' as const, label: 'Quick Test', icon: FlaskConical },
            ].map(({ id, label, icon: Icon }) => (
              <button key={id} onClick={() => setActiveSection(id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeSection === id ? 'bg-white/10 text-emerald-400 border border-emerald-500/30' : 'text-slate-400 hover:bg-white/5'
                }`}>
                <Icon size={12} />{label}
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {activeSection === 'info' && (
              <>
                {/* Role & Personality */}
                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Role</label>
                    {isEditing ? (
                      <input type="text" value={role} onChange={(e) => setRole(e.target.value)}
                        className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/30 transition-colors" placeholder="Agent role" />
                    ) : (
                      <p className="text-sm text-slate-200 mt-1">{agent.role}</p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">Personality</label>
                    {isEditing ? (
                      <input type="text" value={personality} onChange={(e) => setPersonality(e.target.value)}
                        className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/30 transition-colors" placeholder="Personality description" />
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">{agent.personality || 'No personality set'}</p>
                    )}
                  </div>
                </div>

                {/* SOUL.md */}
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">SOUL.md</label>
                  {isEditing ? (
                    <textarea value={soulContent} onChange={(e) => setSoulContent(e.target.value)}
                      className="w-full mt-2 glass-sm p-3 text-sm font-mono text-emerald-300 min-h-[160px] outline-none resize-y focus:border-emerald-500/30 transition-colors" />
                  ) : (
                    <pre className="mt-2 glass-sm p-3 text-sm font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap min-h-[80px]">
                      {agent.soul || 'No SOUL.md content'}
                    </pre>
                  )}
                </div>

                {/* Provider & Model */}
                <div className="flex items-center gap-3">
                  <span className={`text-xs font-medium px-3 py-1 rounded-lg border ${providerColors[agent.provider] || providerColors.custom}`}>
                    {agent.provider}
                  </span>
                  <span className="text-xs text-slate-500 flex items-center gap-1">
                    <Cpu size={12} />{agent.model}
                  </span>
                </div>

                {/* Performance Stats */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="glass-sm p-3 text-center">
                    <CheckCircle2 size={16} className="text-emerald-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-slate-100">{agent.tasksCompleted}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Tasks Done</p>
                  </div>
                  <div className="glass-sm p-3 text-center">
                    <Zap size={16} className="text-amber-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-slate-100">{formatTokens(agent.tokensUsed)}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Tokens</p>
                  </div>
                  <div className="glass-sm p-3 text-center">
                    <Coins size={16} className="text-pink-400 mx-auto mb-1" />
                    <p className="text-lg font-bold text-slate-100">${agent.costUsd.toFixed(4)}</p>
                    <p className="text-[10px] text-slate-500 uppercase">Cost</p>
                  </div>
                </div>
              </>
            )}

            {activeSection === 'history' && (
              <div className="space-y-3">
                {historyLoading ? (
                  <div className="text-center text-slate-500 text-sm py-8">
                    <Loader size={18} className="animate-spin mx-auto mb-2" />Loading task history...
                  </div>
                ) : taskHistory.length === 0 ? (
                  <div className="text-center text-slate-500 text-sm py-8">No tasks found for this agent</div>
                ) : (
                  taskHistory.map((task) => (
                    <div key={task.id} className="glass-sm p-3 space-y-2">
                      <button onClick={() => setExpandedTask(expandedTask === task.id ? null : task.id)}
                        className="w-full flex items-center justify-between text-left">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-200 truncate">{task.title}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-[10px] uppercase font-medium ${statusColor[task.status] || 'text-slate-400'}`}>
                              {task.status.replace('_', ' ')}
                            </span>
                            {task.result && (
                              <span className="text-[10px] text-slate-500">
                                {task.result.tokensUsed} tokens · ${task.result.costUsd.toFixed(4)} · {(task.result.durationMs / 1000).toFixed(1)}s
                              </span>
                            )}
                          </div>
                        </div>
                        {expandedTask === task.id ? <ChevronUp size={14} className="text-slate-500" /> : <ChevronDown size={14} className="text-slate-500" />}
                      </button>
                      {expandedTask === task.id && task.result && (
                        <div className="mt-2 p-2 rounded-lg bg-black/30 text-xs font-mono text-emerald-300/70 max-h-48 overflow-y-auto whitespace-pre-wrap">
                          {task.result.response}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}

            {activeSection === 'test' && (
              <div className="space-y-4">
                <div>
                  <label className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 block">
                    Test Prompt
                  </label>
                  <textarea
                    value={testPrompt}
                    onChange={(e) => setTestPrompt(e.target.value)}
                    placeholder="Send a freeform prompt to this agent..."
                    className="w-full glass-sm p-3 text-sm text-slate-200 min-h-[100px] outline-none resize-y focus:border-emerald-500/30 transition-colors"
                  />
                  <button onClick={handleTest} disabled={testLoading || !testPrompt.trim()}
                    className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-emerald-400 to-cyan-400 text-slate-900 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-50 transition-all">
                    {testLoading ? <Loader size={14} className="animate-spin" /> : <Send size={14} />}
                    {testLoading ? 'Running...' : 'Run Test'}
                  </button>
                </div>
                {testStats && (
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    <span>{testStats.tokensUsed} tokens</span>
                    <span>{(testStats.durationMs / 1000).toFixed(1)}s</span>
                  </div>
                )}
                {testResponse && (
                  <div className="glass-sm p-3 text-sm font-mono text-emerald-300/80 max-h-64 overflow-y-auto whitespace-pre-wrap">
                    {testResponse}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer with Delete */}
          {onDelete && (
            <div className="px-6 pb-6">
              <button onClick={handleDelete}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  confirmDelete ? 'text-red-300 bg-red-500/20 border border-red-500/40' : 'text-red-400 hover:bg-red-500/10 border border-red-500/30'
                }`}>
                {confirmDelete ? (<><AlertTriangle size={14} />Confirm Delete Agent</>) : (<><Trash2 size={14} />Delete Agent</>)}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
