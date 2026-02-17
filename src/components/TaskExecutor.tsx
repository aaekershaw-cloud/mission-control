'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Play, Loader2, Zap, Clock, DollarSign, AlertCircle } from 'lucide-react';
import { Task, Agent, TaskResult } from '@/types';

interface TaskExecutorProps {
  task: Task;
  agents: Agent[];
  onClose: () => void;
  onComplete?: () => void;
}

export default function TaskExecutor({ task, agents, onClose, onComplete }: TaskExecutorProps) {
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<TaskResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pastResults, setPastResults] = useState<TaskResult[]>([]);

  const assignedAgent = agents.find((a) => a.id === task.assigneeId);

  useEffect(() => {
    // Load past results
    fetch(`/api/execute/${task.id}`)
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setPastResults(data); })
      .catch(() => {});
  }, [task.id]);

  const handleRun = async () => {
    setRunning(true);
    setError(null);
    setResult(null);

    try {
      // Read provider config from localStorage
      const stored = localStorage.getItem('mission-control-providers');
      if (!stored) {
        throw new Error('No provider configured. Go to Configuration → Provider Config to set one up.');
      }

      const providers = JSON.parse(stored);
      // Find the default or first provider
      const providerConfig = Array.isArray(providers)
        ? providers[0]
        : providers;

      if (!providerConfig?.apiKey) {
        throw new Error('No API key configured. Go to Configuration → Provider Config to add one.');
      }

      const res = await fetch('/api/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: task.id, providerConfig }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Execution failed');
      }

      setResult(data);
      onComplete?.();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setRunning(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="glass w-full max-w-2xl max-h-[85vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-100">
            ▶ Execute Task
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Task info */}
        <div className="glass-sm p-3 mb-4">
          <p className="text-sm font-medium text-slate-200 mb-1">{task.title}</p>
          {task.description && (
            <p className="text-xs text-slate-400">{task.description}</p>
          )}
        </div>

        {/* Agent */}
        <div className="glass-sm p-3 mb-4">
          {assignedAgent ? (
            <div className="flex items-center gap-2">
              <span className="text-lg">{assignedAgent.avatar}</span>
              <div>
                <p className="text-sm font-medium text-slate-200">{assignedAgent.name}</p>
                <p className="text-xs text-slate-400">{assignedAgent.role}</p>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-500 italic">No agent assigned — assign one first</p>
          )}
        </div>

        {/* Run button */}
        {!result && (
          <button
            onClick={handleRun}
            disabled={running || !assignedAgent}
            className="w-full py-2.5 px-4 rounded-lg font-medium text-sm transition-all
              bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-700 disabled:text-slate-500
              flex items-center justify-center gap-2 mb-4"
          >
            {running ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Running agent...
              </>
            ) : (
              <>
                <Play size={16} />
                Run Agent
              </>
            )}
          </button>
        )}

        {/* Error */}
        {error && (
          <div className="glass-sm p-3 mb-4 border border-red-500/30">
            <div className="flex items-center gap-2 text-red-400 mb-1">
              <AlertCircle size={14} />
              <span className="text-sm font-medium">Error</span>
            </div>
            <p className="text-xs text-red-300">{error}</p>
          </div>
        )}

        {/* Result */}
        {result && (
          <div className="space-y-3">
            {/* Stats */}
            <div className="flex gap-3">
              <div className="glass-sm p-2 flex-1 text-center">
                <div className="flex items-center justify-center gap-1 text-emerald-400 mb-1">
                  <Zap size={12} />
                  <span className="text-xs">Tokens</span>
                </div>
                <p className="text-sm font-mono text-slate-200">{result.tokensUsed.toLocaleString()}</p>
              </div>
              <div className="glass-sm p-2 flex-1 text-center">
                <div className="flex items-center justify-center gap-1 text-blue-400 mb-1">
                  <Clock size={12} />
                  <span className="text-xs">Duration</span>
                </div>
                <p className="text-sm font-mono text-slate-200">{(result.durationMs / 1000).toFixed(1)}s</p>
              </div>
              <div className="glass-sm p-2 flex-1 text-center">
                <div className="flex items-center justify-center gap-1 text-amber-400 mb-1">
                  <DollarSign size={12} />
                  <span className="text-xs">Cost</span>
                </div>
                <p className="text-sm font-mono text-slate-200">${result.costUsd.toFixed(4)}</p>
              </div>
            </div>

            {/* Response */}
            <div className="glass-sm p-4">
              <p className="text-xs text-slate-500 mb-2 uppercase tracking-wider">Response</p>
              <div className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed max-h-[40vh] overflow-y-auto">
                {result.response}
              </div>
            </div>

            {/* Run again */}
            <button
              onClick={() => { setResult(null); setError(null); }}
              className="w-full py-2 px-4 rounded-lg text-sm glass-sm hover:bg-white/5 transition-colors text-slate-300"
            >
              Run Again
            </button>
          </div>
        )}

        {/* Past results */}
        {pastResults.length > 0 && !result && !running && (
          <div className="mt-4">
            <p className="text-xs text-slate-500 uppercase tracking-wider mb-2">Previous Runs</p>
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {pastResults.slice(0, 5).map((r) => (
                <div key={r.id} className="glass-sm p-2 flex items-center justify-between text-xs">
                  <span className="text-slate-400">{new Date(r.createdAt).toLocaleString()}</span>
                  <div className="flex gap-3 text-slate-500">
                    <span>{r.tokensUsed} tokens</span>
                    <span>{(r.durationMs / 1000).toFixed(1)}s</span>
                    <span className={r.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}>
                      {r.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
