'use client';

import { motion } from 'framer-motion';
import { Zap, CheckCircle2 } from 'lucide-react';
import { Agent } from '@/types';
import StatusBadge from './StatusBadge';

interface AgentCardProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

const providerColors: Record<string, string> = {
  'kimi-k2.5': 'bg-orange-500/15 text-orange-400',
  claude: 'bg-purple-500/15 text-purple-400',
  openai: 'bg-emerald-500/15 text-emerald-400',
  custom: 'bg-slate-500/15 text-slate-400',
};

export default function AgentCard({ agent, onClick }: AgentCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(agent)}
      className="glass glass-hover gradient-border cursor-pointer p-5 flex flex-col items-center text-center"
    >
      {/* Avatar */}
      <div className="text-4xl mb-3">{agent.avatar}</div>

      {/* Name & codename */}
      <h3 className="text-sm font-semibold text-slate-100">{agent.name}</h3>
      <p className="text-xs text-slate-500 font-mono mb-1">@{agent.codename}</p>

      {/* Role */}
      <p className="text-xs text-slate-400 mb-3 line-clamp-1">{agent.role}</p>

      {/* Status */}
      <div className="mb-3">
        <StatusBadge status={agent.status} size="sm" />
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-slate-400 mb-3">
        <span className="flex items-center gap-1">
          <CheckCircle2 size={12} className="text-emerald-400" />
          {agent.tasksCompleted}
        </span>
        <span className="flex items-center gap-1">
          <Zap size={12} className="text-amber-400" />
          {formatTokens(agent.tokensUsed)}
        </span>
      </div>

      {/* Current task */}
      {agent.currentTaskId && (
        <p className="text-xs text-cyan-400/70 truncate max-w-full mb-2">
          Working on task...
        </p>
      )}

      {/* Provider badge */}
      <span
        className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
          providerColors[agent.provider] || providerColors.custom
        }`}
      >
        {agent.provider}
      </span>
    </motion.div>
  );
}
