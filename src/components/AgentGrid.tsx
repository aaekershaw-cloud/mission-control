'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Users } from 'lucide-react';
import { Agent, AgentStatus, AGENT_STATUS_CONFIG } from '@/types';
import AgentCard from './AgentCard';

interface AgentGridProps {
  agents: Agent[];
  onAgentClick: (agent: Agent) => void;
}

type FilterStatus = 'all' | AgentStatus;

const filters: { key: FilterStatus; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'online', label: 'Online' },
  { key: 'busy', label: 'Busy' },
  { key: 'idle', label: 'Idle' },
  { key: 'offline', label: 'Offline' },
];

export default function AgentGrid({ agents, onAgentClick }: AgentGridProps) {
  const [filter, setFilter] = useState<FilterStatus>('all');

  const filtered =
    filter === 'all'
      ? agents
      : agents.filter((a) => a.status === filter);

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <Users size={20} className="text-slate-400" />
          <h2 className="text-lg font-semibold text-slate-100">Agent Fleet</h2>
          <span className="text-xs text-slate-500 bg-slate-800/60 px-2 py-0.5 rounded-full">
            {agents.length}
          </span>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-1">
          {filters.map((f) => {
            const isActive = filter === f.key;
            const count =
              f.key === 'all'
                ? agents.length
                : agents.filter((a) => a.status === f.key).length;
            const dotColor =
              f.key !== 'all'
                ? AGENT_STATUS_CONFIG[f.key as AgentStatus].color
                : '';

            return (
              <button
                key={f.key}
                onClick={() => setFilter(f.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  isActive
                    ? 'bg-white/10 text-slate-100'
                    : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                }`}
              >
                {f.key !== 'all' && (
                  <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                )}
                {f.label}
                <span className="text-slate-600">({count})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid */}
      <motion.div
        layout
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
      >
        {filtered.map((agent) => (
          <AgentCard key={agent.id} agent={agent} onClick={onAgentClick} />
        ))}
        {filtered.length === 0 && (
          <div className="col-span-full text-center py-16 text-slate-500 text-sm">
            No agents match the selected filter.
          </div>
        )}
      </motion.div>
    </div>
  );
}
