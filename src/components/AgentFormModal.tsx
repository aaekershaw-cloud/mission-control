'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Save, Plus } from 'lucide-react';
import { ProviderType } from '@/types';

interface AgentFormModalProps {
  onClose: () => void;
  onSave: (agent: {
    name: string;
    codename: string;
    avatar: string;
    role: string;
    personality: string;
    soul: string;
    provider: ProviderType;
    model: string;
  }) => void;
}

const providerModels: Record<ProviderType, string> = {
  'kimi-k2.5': 'moonshotai/kimi-k2.5',
  claude: 'claude-sonnet-4-5-20250929',
  openai: 'gpt-4o',
  custom: 'custom-model',
};

const avatarOptions = ['🤖', '🧠', '⚡', '🛡️', '🔍', '🎨', '👁️', '🚀', '💎', '🔮', '🦾', '🌐'];

export default function AgentFormModal({ onClose, onSave }: AgentFormModalProps) {
  const [name, setName] = useState('');
  const [codename, setCodename] = useState('');
  const [avatar, setAvatar] = useState('🤖');
  const [role, setRole] = useState('');
  const [personality, setPersonality] = useState('');
  const [soul, setSoul] = useState('');
  const [provider, setProvider] = useState<ProviderType>('kimi-k2.5');
  const [model, setModel] = useState(providerModels['kimi-k2.5']);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Auto-generate codename from name
  useEffect(() => {
    if (name && !codename) {
      setCodename(name.toUpperCase().replace(/\s+/g, '-'));
    }
  }, [name, codename]);

  function handleProviderChange(p: ProviderType) {
    setProvider(p);
    setModel(providerModels[p]);
  }

  function handleSave() {
    if (!name.trim() || !role.trim()) return;
    const finalCodename = codename.trim() || name.toUpperCase().replace(/\s+/g, '-');
    onSave({
      name: name.trim(),
      codename: finalCodename,
      avatar,
      role: role.trim(),
      personality: personality.trim(),
      soul: soul || `# ${finalCodename}\n\nYou are ${name.trim()}, a ${role.trim()}.`,
      provider,
      model,
    });
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="glass gradient-border w-full max-w-lg max-h-[85vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5">
            <h2 className="text-lg font-bold text-slate-100 flex items-center gap-2">
              <Plus size={20} className="text-emerald-400" />
              Create Agent
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Avatar picker */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Avatar
              </label>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {avatarOptions.map((a) => (
                  <button
                    key={a}
                    onClick={() => setAvatar(a)}
                    className={`text-2xl p-1.5 rounded-lg transition-all ${
                      avatar === a
                        ? 'bg-white/10 ring-1 ring-emerald-500/40'
                        : 'hover:bg-white/5'
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>

            {/* Name & Codename */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Agent name"
                  className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Codename
                </label>
                <input
                  type="text"
                  value={codename}
                  onChange={(e) => setCodename(e.target.value)}
                  placeholder="AUTO-GENERATED"
                  className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 font-mono outline-none focus:border-emerald-500/30 transition-colors"
                />
              </div>
            </div>

            {/* Role */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Role
              </label>
              <input
                type="text"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                placeholder="e.g. Code Review Specialist"
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
              />
            </div>

            {/* Personality */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Personality
              </label>
              <input
                type="text"
                value={personality}
                onChange={(e) => setPersonality(e.target.value)}
                placeholder="Brief personality description"
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
              />
            </div>

            {/* Provider & Model */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Provider
                </label>
                <select
                  value={provider}
                  onChange={(e) => handleProviderChange(e.target.value as ProviderType)}
                  className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none bg-transparent focus:border-emerald-500/30 transition-colors"
                >
                  <option value="kimi-k2.5" className="bg-slate-900">Kimi K2.5</option>
                  <option value="claude" className="bg-slate-900">Claude</option>
                  <option value="openai" className="bg-slate-900">OpenAI</option>
                  <option value="custom" className="bg-slate-900">Custom</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Model
                </label>
                <input
                  type="text"
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
                />
              </div>
            </div>

            {/* SOUL.md */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                SOUL.md (optional)
              </label>
              <textarea
                value={soul}
                onChange={(e) => setSoul(e.target.value)}
                placeholder="System prompt / agent instructions..."
                rows={4}
                className="w-full mt-1 glass-sm px-3 py-2 text-sm font-mono text-emerald-300 placeholder-slate-600 outline-none resize-none focus:border-emerald-500/30 transition-colors"
              />
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 p-5 border-t border-white/5">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || !role.trim()}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
            >
              <Save size={14} />
              Create Agent
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
