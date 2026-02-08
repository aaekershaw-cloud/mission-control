'use client';

import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send } from 'lucide-react';
import { Message } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface ActivityFeedProps {
  messages: Message[];
  onSendMessage: (content: string) => void;
  compact?: boolean;
}

function highlightMentions(text: string): React.ReactNode[] {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="text-cyan-400 font-medium">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

export default function ActivityFeed({
  messages,
  onSendMessage,
  compact = false,
}: ActivityFeedProps) {
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed) return;
    onSendMessage(trimmed);
    setInput('');
  }

  return (
    <div className={`glass flex flex-col ${compact ? 'h-80' : 'h-full'} rounded-2xl`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-white/5">
        <h3 className="text-sm font-semibold text-slate-200">Activity Feed</h3>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-1">
        <AnimatePresence initial={false}>
          {messages.map((msg) => {
            const isSystem = msg.type === 'system' || msg.type === 'heartbeat';
            const timeAgo = msg.createdAt
              ? formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })
              : '';

            return (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className={`feed-line flex gap-3 py-2 ${
                  isSystem ? 'opacity-60' : ''
                }`}
              >
                {/* Avatar */}
                <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-sm shrink-0">
                  {msg.fromAgentAvatar || '?'}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span
                      className={`text-xs font-semibold ${
                        isSystem ? 'text-slate-500 italic' : 'text-slate-300'
                      }`}
                    >
                      {msg.fromAgentName || 'System'}
                    </span>
                    <span className="text-[10px] text-slate-600">
                      {timeAgo}
                    </span>
                  </div>
                  <p
                    className={`text-sm leading-relaxed ${
                      isSystem
                        ? 'text-slate-500 italic'
                        : msg.type === 'error'
                        ? 'text-red-400'
                        : 'text-slate-300'
                    }`}
                  >
                    {msg.type === 'mention'
                      ? highlightMentions(msg.content)
                      : msg.content}
                  </p>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {messages.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-slate-600">
            No activity yet.
          </div>
        )}
      </div>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="px-4 py-3 border-t border-white/5 flex items-center gap-2"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Send a message..."
          className="flex-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-500 outline-none focus:border-emerald-500/30 transition-colors"
        />
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2 rounded-xl text-slate-400 hover:text-emerald-400 hover:bg-white/5 disabled:opacity-30 transition-all"
        >
          <Send size={16} />
        </button>
      </form>
    </div>
  );
}
