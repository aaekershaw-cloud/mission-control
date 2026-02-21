'use client';

import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Users,
  KanbanSquare,
  MessageSquare,
  BarChart3,
  Shield,
  Settings,
  ChevronLeft,
  ChevronRight,
  Hexagon,
  X,
  Calendar,
  Brain,
  FileText,
  DollarSign,
  Activity,
  ClipboardList,
} from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  collapsed: boolean;
  onToggle: () => void;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'agents', label: 'Agents', icon: Users },
  { id: 'tasks', label: 'Tasks', icon: KanbanSquare },
  { id: 'my-tasks', label: 'My Tasks', icon: ClipboardList },
  { id: 'calendar', label: 'Calendar', icon: Calendar },
  { id: 'memory', label: 'Memory', icon: Brain },
  { id: 'content', label: 'Content', icon: FileText },
  { id: 'activity', label: 'Activity', icon: Activity },
  { id: 'stripe-dashboard', label: 'Revenue', icon: DollarSign },
  { id: 'comms', label: 'Comms', icon: MessageSquare },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'squads', label: 'Squads', icon: Shield },
  { id: 'config', label: 'Config', icon: Settings },
];

export default function Sidebar({
  activeTab,
  onTabChange,
  collapsed,
  onToggle,
  mobileOpen = false,
  onMobileClose,
}: SidebarProps) {
  const handleTabChange = (tab: string) => {
    onTabChange(tab);
    onMobileClose?.();
  };

  const sidebarContent = (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="glass flex flex-col h-full rounded-none border-r border-l-0 border-t-0 border-b-0 border-r-white/5 shrink-0 overflow-hidden max-md:!w-[260px]"
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 h-16 shrink-0 border-b border-white/5">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-400 flex items-center justify-center shrink-0">
          <Hexagon size={20} className="text-slate-900" strokeWidth={2.5} />
        </div>
        <AnimatePresence>
          {(!collapsed || mobileOpen) && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden whitespace-nowrap flex-1"
            >
              <span className="text-xs font-bold tracking-[0.2em] text-slate-400 uppercase">
                Mission Control
              </span>
            </motion.div>
          )}
        </AnimatePresence>
        {/* Mobile close button */}
        {mobileOpen && (
          <button
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 space-y-1 px-3 overflow-y-auto">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          const Icon = item.icon;

          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group relative ${
                isActive
                  ? 'nav-active bg-white/5 text-emerald-400'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Icon
                size={20}
                className={`shrink-0 transition-colors ${
                  isActive ? 'text-emerald-400' : 'text-slate-500 group-hover:text-slate-300'
                }`}
              />
              <AnimatePresence>
                {(!collapsed || mobileOpen) && (
                  <motion.span
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -8 }}
                    transition={{ duration: 0.15 }}
                    className="text-sm font-medium whitespace-nowrap"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          );
        })}
      </nav>

      {/* Collapse toggle - hidden on mobile */}
      <div className="px-3 pb-4 shrink-0 hidden md:block">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-all"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
          <AnimatePresence>
            {!collapsed && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs font-medium"
              >
                Collapse
              </motion.span>
            )}
          </AnimatePresence>
        </button>
      </div>
    </motion.aside>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <div className="hidden md:flex h-full">
        {sidebarContent}
      </div>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={onMobileClose}
            />
            <motion.div
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              className="md:hidden fixed inset-y-0 left-0 z-50 w-[260px]"
            >
              {sidebarContent}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
