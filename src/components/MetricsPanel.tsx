'use client';

import { motion } from 'framer-motion';
import {
  Users,
  Zap,
  CheckCircle2,
  ListTodo,
  Coins,
  Activity,
} from 'lucide-react';
import GlassCard from './GlassCard';

interface MetricsPanelProps {
  metrics: {
    totalAgents: number;
    activeAgents: number;
    totalTasks: number;
    completedTasks: number;
    totalTokens: number;
    totalCost: number;
  };
}

interface MetricItemProps {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
  gradient?: boolean;
  trend?: { value: number; up: boolean };
  delay: number;
}

function MetricItem({ icon, iconBg, label, value, gradient, trend, delay }: MetricItemProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay }}
    >
      <GlassCard className="flex items-center gap-4">
        <div
          className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            {label}
          </p>
          <p
            className={`text-xl font-bold mt-0.5 ${
              gradient ? 'gradient-text' : 'text-slate-100'
            }`}
          >
            {value}
          </p>
        </div>
        {trend && (
          <div
            className={`ml-auto text-xs font-medium flex items-center gap-0.5 ${
              trend.up ? 'text-emerald-400' : 'text-red-400'
            }`}
          >
            <span>{trend.up ? '\u2191' : '\u2193'}</span>
            <span>{trend.value}%</span>
          </div>
        )}
      </GlassCard>
    </motion.div>
  );
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function MetricsPanel({ metrics }: MetricsPanelProps) {
  const safe = {
    totalAgents: Number(metrics?.totalAgents ?? 0),
    activeAgents: Number(metrics?.activeAgents ?? 0),
    totalTasks: Number(metrics?.totalTasks ?? 0),
    completedTasks: Number(metrics?.completedTasks ?? 0),
    totalTokens: Number(metrics?.totalTokens ?? 0),
    totalCost: Number(metrics?.totalCost ?? 0),
  };

  const completionRate =
    safe.totalTasks > 0
      ? Math.round((safe.completedTasks / safe.totalTasks) * 100)
      : 0;

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      <MetricItem
        icon={<Users size={20} className="text-emerald-400" />}
        iconBg="bg-emerald-500/15"
        label="Total Agents"
        value={String(safe.totalAgents)}
        gradient
        delay={0}
      />
      <MetricItem
        icon={<Activity size={20} className="text-cyan-400" />}
        iconBg="bg-cyan-500/15"
        label="Active"
        value={String(safe.activeAgents)}
        trend={{ value: safe.activeAgents > 0 ? 12 : 0, up: true }}
        delay={0.05}
      />
      <MetricItem
        icon={<ListTodo size={20} className="text-blue-400" />}
        iconBg="bg-blue-500/15"
        label="Total Tasks"
        value={String(safe.totalTasks)}
        delay={0.1}
      />
      <MetricItem
        icon={<CheckCircle2 size={20} className="text-purple-400" />}
        iconBg="bg-purple-500/15"
        label="Completed"
        value={`${safe.completedTasks} (${completionRate}%)`}
        trend={{ value: completionRate, up: completionRate > 50 }}
        delay={0.15}
      />
      <MetricItem
        icon={<Zap size={20} className="text-amber-400" />}
        iconBg="bg-amber-500/15"
        label="Tokens Used"
        value={formatTokens(safe.totalTokens)}
        delay={0.2}
      />
      <MetricItem
        icon={<Coins size={20} className="text-pink-400" />}
        iconBg="bg-pink-500/15"
        label="Total Cost"
        value={`$${safe.totalCost.toFixed(2)}`}
        delay={0.25}
      />
    </div>
  );
}
