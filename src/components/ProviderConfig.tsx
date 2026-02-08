'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Key,
  Globe,
  Cpu,
  Save,
  Zap,
  CheckCircle2,
  Loader2,
  Star,
} from 'lucide-react';
import { ProviderConfig as ProviderConfigType, DEFAULT_PROVIDERS, ProviderType } from '@/types';

interface ProviderConfigProps {
  onSave: (config?: ProviderConfigType) => void;
}

const providerMeta: Record<string, { label: string; color: string; borderColor: string }> = {
  'kimi-k2.5': { label: 'Kimi K2.5', color: 'from-orange-500 to-amber-500', borderColor: 'border-orange-500/30' },
  claude: { label: 'Claude', color: 'from-purple-500 to-violet-500', borderColor: 'border-purple-500/30' },
  openai: { label: 'OpenAI', color: 'from-emerald-500 to-green-500', borderColor: 'border-emerald-500/30' },
  custom: { label: 'Custom', color: 'from-slate-400 to-slate-500', borderColor: 'border-slate-500/30' },
};

const providerKeys: ProviderType[] = ['kimi-k2.5', 'claude', 'openai', 'custom'];

export default function ProviderConfig({ onSave }: ProviderConfigProps) {
  const [activeProvider, setActiveProvider] = useState<ProviderType>('kimi-k2.5');
  const [defaultProvider, setDefaultProvider] = useState<ProviderType>('kimi-k2.5');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'success' | 'error' | null>(null);

  const [configs, setConfigs] = useState<Record<string, ProviderConfigType>>(() => {
    const initial: Record<string, ProviderConfigType> = {};
    for (const [key, val] of Object.entries(DEFAULT_PROVIDERS)) {
      initial[key] = { ...val, apiKey: '' };
    }
    initial.custom = {
      type: 'custom',
      name: 'Custom Provider',
      baseUrl: '',
      apiKey: '',
      model: '',
      contextWindow: 128000,
      maxTokens: 4096,
    };
    return initial;
  });

  const currentConfig = configs[activeProvider];

  function updateField(field: keyof ProviderConfigType, value: string | number) {
    setConfigs((prev) => ({
      ...prev,
      [activeProvider]: { ...prev[activeProvider], [field]: value },
    }));
    setTestResult(null);
  }

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    // Simulate test connection
    await new Promise((r) => setTimeout(r, 1500));
    setTestResult(currentConfig.apiKey ? 'success' : 'error');
    setTesting(false);
  }

  function handleSave() {
    onSave(currentConfig);
  }

  return (
    <div className="space-y-6">
      {/* Provider cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {providerKeys.map((key, i) => {
          const meta = providerMeta[key];
          const isActive = activeProvider === key;
          const isDefault = defaultProvider === key;

          return (
            <motion.button
              key={key}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: i * 0.05 }}
              onClick={() => setActiveProvider(key)}
              className={`glass-sm p-4 text-left transition-all ${
                isActive ? 'gradient-border ring-1 ring-white/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div
                  className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta.color} flex items-center justify-center`}
                >
                  <Cpu size={14} className="text-white" />
                </div>
                {isDefault && (
                  <Star size={12} className="text-amber-400 fill-amber-400" />
                )}
              </div>
              <p className="text-sm font-semibold text-slate-200">{meta.label}</p>
              <p className="text-[10px] text-slate-500 mt-0.5">
                {configs[key]?.model || 'Not configured'}
              </p>
            </motion.button>
          );
        })}
      </div>

      {/* Config form */}
      <motion.div
        key={activeProvider}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="glass rounded-2xl p-6 space-y-4"
      >
        <h3 className="text-sm font-semibold text-slate-200">
          {providerMeta[activeProvider].label} Configuration
        </h3>

        {/* API Key */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
            <Key size={10} />
            API Key
          </label>
          <input
            type="password"
            value={currentConfig.apiKey}
            onChange={(e) => updateField('apiKey', e.target.value)}
            placeholder="sk-..."
            className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none font-mono focus:border-emerald-500/30 transition-colors"
          />
        </div>

        {/* Base URL */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
            <Globe size={10} />
            Base URL
          </label>
          <input
            type="text"
            value={currentConfig.baseUrl}
            onChange={(e) => updateField('baseUrl', e.target.value)}
            placeholder="https://api.example.com/v1"
            className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none font-mono focus:border-emerald-500/30 transition-colors"
          />
        </div>

        {/* Model */}
        <div>
          <label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1">
            <Cpu size={10} />
            Model
          </label>
          <input
            type="text"
            value={currentConfig.model}
            onChange={(e) => updateField('model', e.target.value)}
            placeholder="model-name"
            className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none font-mono focus:border-emerald-500/30 transition-colors"
          />
        </div>

        {/* Context window & max tokens */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Context Window
            </label>
            <input
              type="number"
              value={currentConfig.contextWindow}
              onChange={(e) => updateField('contextWindow', parseInt(e.target.value) || 0)}
              className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none font-mono focus:border-emerald-500/30 transition-colors"
            />
          </div>
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Max Tokens
            </label>
            <input
              type="number"
              value={currentConfig.maxTokens}
              onChange={(e) => updateField('maxTokens', parseInt(e.target.value) || 0)}
              className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none font-mono focus:border-emerald-500/30 transition-colors"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={handleTest}
            disabled={testing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5 disabled:opacity-50 transition-all"
          >
            {testing ? (
              <Loader2 size={14} className="animate-spin" />
            ) : testResult === 'success' ? (
              <CheckCircle2 size={14} className="text-emerald-400" />
            ) : (
              <Zap size={14} />
            )}
            {testing ? 'Testing...' : testResult === 'success' ? 'Connected' : 'Test Connection'}
          </button>

          <button
            onClick={() => setDefaultProvider(activeProvider)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
              defaultProvider === activeProvider
                ? 'text-amber-400 border border-amber-500/30 bg-amber-500/10'
                : 'text-slate-300 border border-white/10 hover:border-white/20 hover:bg-white/5'
            }`}
          >
            <Star size={14} className={defaultProvider === activeProvider ? 'fill-amber-400' : ''} />
            {defaultProvider === activeProvider ? 'Default' : 'Set as Default'}
          </button>

          <button
            onClick={handleSave}
            className="ml-auto flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Save size={14} />
            Save
          </button>
        </div>

        {/* Test result */}
        {testResult === 'error' && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-xs text-red-400"
          >
            Connection failed. Please check your API key and base URL.
          </motion.p>
        )}
      </motion.div>
    </div>
  );
}
