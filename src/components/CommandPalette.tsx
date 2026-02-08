'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  LayoutDashboard,
  Users,
  KanbanSquare,
  MessageSquare,
  BarChart3,
  Shield,
  Settings,
  Plus,
  PanelLeftClose,
  Command,
} from 'lucide-react';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onCommand: (command: string) => void;
}

interface CommandItem {
  id: string;
  label: string;
  description: string;
  icon: React.ReactNode;
  shortcut?: string;
}

const commands: CommandItem[] = [
  { id: 'tab:dashboard', label: 'Go to Dashboard', description: 'View overview and metrics', icon: <LayoutDashboard size={16} /> },
  { id: 'tab:agents', label: 'Go to Agents', description: 'Manage agent fleet', icon: <Users size={16} /> },
  { id: 'tab:tasks', label: 'Go to Tasks', description: 'Kanban task board', icon: <KanbanSquare size={16} /> },
  { id: 'tab:comms', label: 'Go to Comms', description: 'Activity feed & messages', icon: <MessageSquare size={16} /> },
  { id: 'tab:analytics', label: 'Go to Analytics', description: 'Performance metrics', icon: <BarChart3 size={16} /> },
  { id: 'tab:squads', label: 'Go to Squads', description: 'Squad management', icon: <Shield size={16} /> },
  { id: 'tab:config', label: 'Go to Config', description: 'Provider settings', icon: <Settings size={16} /> },
  { id: 'create:agent', label: 'Create New Agent', description: 'Add an AI agent', icon: <Plus size={16} />, shortcut: 'N' },
  { id: 'create:task', label: 'Create New Task', description: 'Add a new task', icon: <Plus size={16} />, shortcut: 'T' },
  { id: 'create:squad', label: 'Create New Squad', description: 'Form an agent squad', icon: <Shield size={16} /> },
  { id: 'toggle:sidebar', label: 'Toggle Sidebar', description: 'Collapse or expand sidebar', icon: <PanelLeftClose size={16} />, shortcut: '[' },
];

export default function CommandPalette({
  isOpen,
  onClose,
  onCommand,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = commands.filter(
    (cmd) =>
      cmd.label.toLowerCase().includes(query.toLowerCase()) ||
      cmd.description.toLowerCase().includes(query.toLowerCase())
  );

  const handleSelect = useCallback(
    (commandId: string) => {
      onCommand(commandId);
      onClose();
      setQuery('');
      setSelectedIndex(0);
    },
    [onCommand, onClose]
  );

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && filtered.length > 0) {
        e.preventDefault();
        handleSelect(filtered[selectedIndex].id);
      } else if (e.key === 'Escape') {
        onClose();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, filtered, selectedIndex, handleSelect, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
          className="fixed inset-0 modal-overlay z-50 flex items-start justify-center pt-[20vh]"
          onClick={(e) => {
            if (e.target === e.currentTarget) onClose();
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2 }}
            className="glass gradient-border w-full max-w-lg overflow-hidden"
          >
            {/* Search input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
              <Command size={16} className="text-slate-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Type a command..."
                className="flex-1 bg-transparent text-sm text-slate-200 placeholder-slate-500 outline-none"
              />
              <kbd className="text-[10px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded">
                ESC
              </kbd>
            </div>

            {/* Commands list */}
            <div className="max-h-[320px] overflow-y-auto py-2">
              {filtered.map((cmd, i) => (
                <button
                  key={cmd.id}
                  onClick={() => handleSelect(cmd.id)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                    i === selectedIndex
                      ? 'bg-white/5 text-slate-100'
                      : 'text-slate-400 hover:bg-white/5'
                  }`}
                >
                  <span
                    className={`shrink-0 ${
                      i === selectedIndex ? 'text-emerald-400' : 'text-slate-500'
                    }`}
                  >
                    {cmd.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{cmd.label}</p>
                    <p className="text-xs text-slate-500 truncate">
                      {cmd.description}
                    </p>
                  </div>
                  {cmd.shortcut && (
                    <kbd className="text-[10px] text-slate-600 bg-slate-800/60 px-1.5 py-0.5 rounded shrink-0">
                      {cmd.shortcut}
                    </kbd>
                  )}
                </button>
              ))}

              {filtered.length === 0 && (
                <div className="text-center py-8 text-sm text-slate-600">
                  No commands found.
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
