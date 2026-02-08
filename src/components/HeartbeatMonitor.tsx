'use client';

import { motion } from 'framer-motion';
import { Heart, Zap } from 'lucide-react';
import { Agent } from '@/types';
import StatusBadge from './StatusBadge';

interface HeartbeatMonitorProps {
  agents: Agent[];
}

function getHeartbeatHealth(lastHeartbeat: string | null): {
  color: string;
  label: string;
  bgColor: string;
} {
  if (!lastHeartbeat) {
    return { color: 'text-slate-500', label: 'Never', bgColor: 'bg-slate-500' };
  }

  const diff = Date.now() - new Date(lastHeartbeat).getTime();
  const minutes = diff / 60_000;

  if (minutes < 2) {
    return { color: 'text-emerald-400', label: `${Math.round(minutes * 60)}s ago`, bgColor: 'bg-emerald-500' };
  }
  if (minutes < 5) {
    return { color: 'text-amber-400', label: `${Math.round(minutes)}m ago`, bgColor: 'bg-amber-500' };
  }
  return { color: 'text-red-400', label: `${Math.round(minutes)}m ago`, bgColor: 'bg-red-500' };
}

export default function HeartbeatMonitor({ agents }: HeartbeatMonitorProps) {
  return (
    <div className="glass rounded-2xl flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5">
        <Heart size={16} className="text-red-400" />
        <h3 className="text-sm font-semibold text-slate-200">
          Heartbeat Monitor
        </h3>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {agents.map((agent, i) => {
          const health = getHeartbeatHealth(agent.lastHeartbeat);

          return (
            <motion.div
              key={agent.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
              className="glass-sm p-3 flex items-center gap-3"
            >
              {/* Avatar & heartbeat dot */}
              <div className="relative">
                <div className="text-xl">{agent.avatar}</div>
                <span
                  className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900 ${health.bgColor}`}
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-slate-200 truncate">
                    {agent.name}
                  </span>
                  <StatusBadge status={agent.status} size="sm" />
                </div>
                <span className={`text-[10px] ${health.color}`}>
                  {health.label}
                </span>
              </div>

              {/* Stats */}
              <div className="flex flex-col items-end gap-1">
                {/* Task progress for busy agents */}
                {agent.status === 'busy' && (
                  <div className="w-16 h-1.5 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all"
                      style={{ width: '60%' }}
                    />
                  </div>
                )}

                {/* Tokens */}
                <div className="flex items-center gap-1 text-[10px] text-slate-500">
                  <Zap size={8} />
                  <span>
                    {agent.tokensUsed >= 1000
                      ? `${(agent.tokensUsed / 1000).toFixed(1)}K`
                      : agent.tokensUsed}
                  </span>
                </div>
              </div>
            </motion.div>
          );
        })}

        {agents.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-slate-600">
            No agents registered.
          </div>
        )}
      </div>
    </div>
  );
}
