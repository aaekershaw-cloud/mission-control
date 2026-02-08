'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Edit3, Save, Clock, Zap, Coins, CheckCircle2, Cpu } from 'lucide-react';
import { Agent } from '@/types';
import StatusBadge from './StatusBadge';

interface AgentDetailProps {
  agent: Agent;
  onClose: () => void;
  onUpdate: (agent: Agent) => void;
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

export default function AgentDetail({ agent, onClose, onUpdate }: AgentDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [soulContent, setSoulContent] = useState(agent.soul || '');

  function handleSave() {
    onUpdate({ ...agent, soul: soulContent });
    setIsEditing(false);
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
              <div className="text-5xl">{agent.avatar}</div>
              <div>
                <h2 className="text-lg font-bold text-slate-100">{agent.name}</h2>
                <p className="text-sm text-slate-500 font-mono">@{agent.codename}</p>
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

          {/* Body */}
          <div className="p-6 space-y-6">
            {/* Role & Personality */}
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Role
                </label>
                <p className="text-sm text-slate-200 mt-1">{agent.role}</p>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Personality
                </label>
                <p className="text-sm text-slate-400 mt-1">{agent.personality}</p>
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
