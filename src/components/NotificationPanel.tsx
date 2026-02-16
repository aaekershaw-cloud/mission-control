'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Bell, Check, CheckCheck, MessageSquare, X } from 'lucide-react';
import { Message } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: Message[];
  onMarkRead: (messageId: string) => void;
  onMarkAllRead: () => void;
}

export default function NotificationPanel({
  isOpen,
  onClose,
  messages,
  onMarkRead,
  onMarkAllRead,
}: NotificationPanelProps) {
  const unreadMessages = messages.filter((m) => !m.read);
  const recentMessages = messages.slice(0, 20);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute right-0 top-full mt-2 w-96 glass gradient-border rounded-2xl overflow-hidden z-50 shadow-2xl shadow-black/50"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
              <div className="flex items-center gap-2">
                <Bell size={14} className="text-emerald-400" />
                <span className="text-sm font-semibold text-slate-200">
                  Notifications
                </span>
                {unreadMessages.length > 0 && (
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400">
                    {unreadMessages.length}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {unreadMessages.length > 0 && (
                  <button
                    onClick={onMarkAllRead}
                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium text-slate-400 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                    title="Mark all as read"
                  >
                    <CheckCheck size={12} />
                    Mark all read
                  </button>
                )}
                <button
                  onClick={onClose}
                  className="p-1 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Messages list */}
            <div className="max-h-80 overflow-y-auto">
              {recentMessages.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-600">
                  No notifications yet
                </div>
              ) : (
                recentMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-start gap-3 px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                      !msg.read
                        ? 'bg-emerald-500/5 hover:bg-emerald-500/10'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="shrink-0 mt-0.5">
                      {msg.fromAgentAvatar ? (
                        <span className="text-lg">{msg.fromAgentAvatar}</span>
                      ) : (
                        <MessageSquare size={16} className="text-slate-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <span className="text-xs font-medium text-slate-300">
                          {msg.fromAgentName || 'System'}
                        </span>
                        {!msg.read && (
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                        )}
                      </div>
                      <p className="text-xs text-slate-400 line-clamp-2">
                        {msg.content}
                      </p>
                      <span className="text-[10px] text-slate-600 mt-0.5 block">
                        {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    {!msg.read && (
                      <button
                        onClick={() => onMarkRead(msg.id)}
                        className="shrink-0 p-1 rounded-lg text-slate-600 hover:text-emerald-400 hover:bg-white/5 transition-colors"
                        title="Mark as read"
                      >
                        <Check size={12} />
                      </button>
                    )}
                  </div>
                ))
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
