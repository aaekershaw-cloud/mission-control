'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Search, Bell, Plus, ListPlus, Clock } from 'lucide-react';

interface HeaderProps {
  title: string;
  onNewAgent: () => void;
  onNewTask: () => void;
}

export default function Header({ title, onNewAgent, onNewTask }: HeaderProps) {
  const [time, setTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const updateTime = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: false,
        })
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between px-6 h-16 border-b border-white/5 shrink-0"
    >
      {/* Title */}
      <h1 className="text-xl font-semibold text-slate-100">{title}</h1>

      {/* Right section */}
      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="relative">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-sm pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 w-56 outline-none focus:border-emerald-500/30 transition-colors"
          />
        </div>

        {/* Notification bell */}
        <button className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors">
          <Bell size={18} />
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-400" />
        </button>

        {/* Time */}
        <div className="flex items-center gap-1.5 text-sm text-slate-500 font-mono px-2">
          <Clock size={14} />
          <span>{time}</span>
        </div>

        {/* New Task */}
        <button
          onClick={onNewTask}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
        >
          <ListPlus size={16} />
          <span>New Task</span>
        </button>

        {/* New Agent */}
        <button
          onClick={onNewAgent}
          className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={16} />
          <span>New Agent</span>
        </button>
      </div>
    </motion.header>
  );
}
