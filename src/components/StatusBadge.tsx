'use client';

import { AgentStatus, AGENT_STATUS_CONFIG } from '@/types';

interface StatusBadgeProps {
  status: AgentStatus;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: { dot: 'w-2 h-2', text: 'text-xs', gap: 'gap-1.5', px: 'px-2 py-0.5' },
  md: { dot: 'w-2.5 h-2.5', text: 'text-sm', gap: 'gap-2', px: 'px-2.5 py-1' },
  lg: { dot: 'w-3 h-3', text: 'text-base', gap: 'gap-2.5', px: 'px-3 py-1.5' },
};

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = AGENT_STATUS_CONFIG[status];
  const s = sizeMap[size];

  return (
    <span
      className={`inline-flex items-center ${s.gap} ${s.px} rounded-full bg-slate-800/60`}
    >
      <span
        className={`${s.dot} rounded-full ${config.color} ${config.pulse ? 'status-pulse' : ''}`}
      />
      <span className={`${s.text} text-slate-300 font-medium`}>
        {config.label}
      </span>
    </span>
  );
}
