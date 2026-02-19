'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Bell,
  Plus,
  ListPlus,
  Clock,
  User,
  KanbanSquare,
  MessageSquare,
  Menu,
  X,
} from 'lucide-react';
import { Agent, Task, Message } from '@/types';
import NotificationPanel from './NotificationPanel';

interface SearchResult {
  type: 'agent' | 'task' | 'message';
  id: string;
  title: string;
  subtitle: string;
}

interface HeaderProps {
  title: string;
  onNewAgent: () => void;
  onNewTask: () => void;
  messages?: Message[];
  agents?: Agent[];
  tasks?: Task[];
  unreadCount?: number;
  onNavigate?: (tab: string, itemId?: string) => void;
  onMarkRead?: (messageId: string) => void;
  onMarkAllRead?: () => void;
  onMenuToggle?: () => void;
}

const resultTypeIcon = {
  agent: User,
  task: KanbanSquare,
  message: MessageSquare,
};

const resultTypeColor = {
  agent: 'text-emerald-400',
  task: 'text-amber-400',
  message: 'text-cyan-400',
};

export default function Header({
  title,
  onNewAgent,
  onNewTask,
  messages = [],
  unreadCount = 0,
  onNavigate,
  onMarkRead,
  onMarkAllRead,
  onMenuToggle,
}: HeaderProps) {
  const [time, setTime] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

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

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data);
        setSearchOpen(data.length > 0);
      }
    } catch (err) {
      console.error('Search failed:', err);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(value), 300);
  };

  const handleResultClick = (result: SearchResult) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults([]);
    setMobileSearchOpen(false);
    if (!onNavigate) return;

    switch (result.type) {
      case 'agent':
        onNavigate('agents', result.id);
        break;
      case 'task':
        onNavigate('tasks', result.id);
        break;
      case 'message':
        onNavigate('comms', result.id);
        break;
    }
  };

  return (
    <motion.header
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex items-center justify-between px-3 md:px-6 h-14 md:h-16 border-b border-white/5 shrink-0 gap-2"
    >
      {/* Mobile menu button */}
      <button
        onClick={onMenuToggle}
        className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors shrink-0"
      >
        <Menu size={20} />
      </button>

      {/* Title */}
      <h1 className="text-base md:text-xl font-semibold text-slate-100 truncate">{title}</h1>

      {/* Right section */}
      <div className="flex items-center gap-1.5 md:gap-3">
        {/* Search - desktop */}
        <div ref={searchRef} className="relative hidden md:block">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
          />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => handleSearchChange(e.target.value)}
            onFocus={() => {
              if (searchResults.length > 0) setSearchOpen(true);
            }}
            className="glass-sm pl-9 pr-4 py-2 text-sm text-slate-200 placeholder-slate-500 w-56 outline-none focus:border-emerald-500/30 transition-colors"
          />

          <AnimatePresence>
            {searchOpen && searchResults.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.15 }}
                className="absolute top-full mt-2 left-0 right-0 glass gradient-border rounded-xl overflow-hidden z-50 shadow-2xl shadow-black/50"
              >
                {searchResults.map((result) => {
                  const Icon = resultTypeIcon[result.type];
                  return (
                    <button
                      key={`${result.type}-${result.id}`}
                      onClick={() => handleResultClick(result)}
                      className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                    >
                      <Icon size={14} className={resultTypeColor[result.type]} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{result.title}</p>
                        <p className="text-[10px] text-slate-500 truncate">{result.subtitle}</p>
                      </div>
                      <span className="text-[10px] text-slate-600 uppercase shrink-0">{result.type}</span>
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Search - mobile toggle */}
        <button
          onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
          className="md:hidden p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
        >
          {mobileSearchOpen ? <X size={18} /> : <Search size={18} />}
        </button>

        {/* Notification bell */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen((prev) => !prev)}
            className="relative p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-colors"
          >
            <Bell size={18} />
            {unreadCount > 0 && (
              <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-emerald-400 text-[10px] font-bold text-slate-900 px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          <NotificationPanel
            isOpen={notificationsOpen}
            onClose={() => setNotificationsOpen(false)}
            messages={messages}
            onMarkRead={onMarkRead || (() => {})}
            onMarkAllRead={onMarkAllRead || (() => {})}
          />
        </div>

        {/* Time - hidden on mobile */}
        <div className="hidden lg:flex items-center gap-1.5 text-sm text-slate-500 font-mono px-2">
          <Clock size={14} />
          <span>{time}</span>
        </div>

        {/* New Task - hidden on small mobile */}
        <button
          onClick={onNewTask}
          className="hidden sm:flex items-center gap-1.5 px-2.5 md:px-3 py-2 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5 transition-all"
        >
          <ListPlus size={16} />
          <span className="hidden md:inline">New Task</span>
        </button>

        {/* New Agent */}
        <button
          onClick={onNewAgent}
          className="flex items-center gap-1.5 px-3 md:px-4 py-2 rounded-xl text-sm font-medium text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-all shadow-lg shadow-emerald-500/20"
        >
          <Plus size={16} />
          <span className="hidden sm:inline">New Agent</span>
        </button>
      </div>

      {/* Mobile search bar - slides down */}
      <AnimatePresence>
        {mobileSearchOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden absolute top-14 left-0 right-0 px-3 py-2 bg-[#0a1128] border-b border-white/5 z-30"
          >
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Search agents, tasks, messages..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                autoFocus
                className="glass-sm pl-9 pr-4 py-2.5 text-sm text-slate-200 placeholder-slate-500 w-full outline-none focus:border-emerald-500/30 transition-colors"
              />
              <AnimatePresence>
                {searchOpen && searchResults.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full mt-2 left-0 right-0 glass gradient-border rounded-xl overflow-hidden z-50 shadow-2xl shadow-black/50"
                  >
                    {searchResults.map((result) => {
                      const Icon = resultTypeIcon[result.type];
                      return (
                        <button
                          key={`${result.type}-${result.id}`}
                          onClick={() => handleResultClick(result)}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-white/5 transition-colors border-b border-white/5 last:border-0"
                        >
                          <Icon size={14} className={resultTypeColor[result.type]} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-slate-200 truncate">{result.title}</p>
                            <p className="text-[10px] text-slate-500 truncate">{result.subtitle}</p>
                          </div>
                        </button>
                      );
                    })}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}
