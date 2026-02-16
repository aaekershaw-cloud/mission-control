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
} from 'lucide-react';
import { Agent, AgentStatus } from '@/types';
import StatusBadge from './StatusBadge';

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

  // Editable fields
  const [name, setName] = useState(agent.name);
  const [codename, setCodename] = useState(agent.codename);
  const [avatar, setAvatar] = useState(agent.avatar);
  const [role, setRole] = useState(agent.role);
  const [personality, setPersonality] = useState(agent.personality || '');
  const [soulContent, setSoulContent] = useState(agent.soul || '');

  useEffect(() => {
    setName(agent.name);
    setCodename(agent.codename);
    setAvatar(agent.avatar);
    setRole(agent.role);
    setPersonality(agent.personality || '');
    setSoulContent(agent.soul || '');
    setIsEditing(false);
    setConfirmDelete(false);
  }, [agent]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

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

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4"
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
          <div className="flex items-start justify-between p-6 border-b border-white/5">
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
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="glass-sm px-2 py-1 text-lg font-bold text-slate-100 outline-none focus:border-emerald-500/30 transition-colors w-full"
                      placeholder="Agent name"
                    />
                    <input
                      type="text"
                      value={codename}
                      onChange={(e) => setCodename(e.target.value)}
                      className="glass-sm px-2 py-1 text-sm text-slate-500 font-mono outline-none focus:border-emerald-500/30 transition-colors w-full"
                      placeholder="CODENAME"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-slate-100">{agent.name}</h2>
                    <p className="text-sm text-slate-500 font-mono">@{agent.codename}</p>
                  </>
                )}
                <div className="mt-1.5 flex items-center gap-2">
                  <StatusBadge status={agent.status} size="sm" />
                  {agent.lastHeartbeat && (
                    <span className="text-[10px] text-slate-600 flex items-center gap-1">
                      <Clock size={10} />
                      Last heartbeat: {new Date(agent.lastHeartbeat).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => (isEditing ? handleSave() : setIsEditing(true))}
                className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-white/5 transition-all"
                title={isEditing ? 'Save changes' : 'Edit agent'}
              >
                {isEditing ? <Save size={18} /> : <Edit3 size={18} />}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
              >
                <X size={18} />
              </button>
            </div>
          </div>

          {/* Quick Status Toggles */}
          <div className="px-6 pt-4">
            <label className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 block">
              Quick Status
            </label>
            <div className="flex items-center gap-2">
              {statusButtons.map(({ status, icon: Icon, label }) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(status)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    agent.status === status
                      ? `${statusButtonColors[status]} bg-white/5`
                      : 'text-slate-500 border-transparent hover:border-white/10'
                  }`}
                >
                  <Icon size={12} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Role & Personality */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Role
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/30 transition-colors"
                    placeholder="Agent role"
                  />
                ) : (
                  <p className="text-sm text-slate-200 mt-1">{agent.role}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Personality
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={personality}
                    onChange={(e) => setPersonality(e.target.value)}
                    className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none focus:border-emerald-500/30 transition-colors"
                    placeholder="Personality description"
                  />
                ) : (
                  <p className="text-sm text-slate-400 mt-1">{agent.personality || 'No personality set'}</p>
                )}
              </div>
            </div>

            {/* SOUL.md */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                SOUL.md
              </label>
              {isEditing ? (
                <textarea
                  value={soulContent}
                  onChange={(e) => setSoulContent(e.target.value)}
                  className="w-full mt-2 glass-sm p-3 text-sm font-mono text-emerald-300 min-h-[160px] outline-none resize-y focus:border-emerald-500/30 transition-colors"
                />
              ) : (
                <pre className="mt-2 glass-sm p-3 text-sm font-mono text-emerald-300/80 overflow-x-auto whitespace-pre-wrap min-h-[80px]">
                  {agent.soul || 'No SOUL.md content'}
                </pre>
              )}
            </div>

            {/* Provider & Model */}
            <div className="flex items-center gap-3">
              <span
                className={`text-xs font-medium px-3 py-1 rounded-lg border ${
                  providerColors[agent.provider] || providerColors.custom
                }`}
              >
                {agent.provider}
              </span>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Cpu size={12} />
                {agent.model}
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
                <p className="text-lg font-bold text-slate-100">
                  {formatTokens(agent.tokensUsed)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase">Tokens</p>
              </div>
              <div className="glass-sm p-3 text-center">
                <Coins size={16} className="text-pink-400 mx-auto mb-1" />
                <p className="text-lg font-bold text-slate-100">
                  ${agent.costUsd.toFixed(2)}
                </p>
                <p className="text-[10px] text-slate-500 uppercase">Cost</p>
              </div>
            </div>

            {/* Current Task */}
            {agent.currentTaskId && (
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Current Task
                </label>
                <div className="glass-sm p-3 mt-2">
                  <p className="text-sm text-cyan-400">
                    Task: {agent.currentTaskId}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Footer with Delete */}
          {onDelete && (
            <div className="px-6 pb-6">
              <button
                onClick={handleDelete}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  confirmDelete
                    ? 'text-red-300 bg-red-500/20 border border-red-500/40'
                    : 'text-red-400 hover:bg-red-500/10 border border-red-500/30'
                }`}
              >
                {confirmDelete ? (
                  <>
                    <AlertTriangle size={14} />
                    Confirm Delete Agent
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete Agent
                  </>
                )}
              </button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
