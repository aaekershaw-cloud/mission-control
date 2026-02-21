'use client';

import { useEffect, useMemo, useState } from 'react';

type Task = {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'critical' | 'high' | 'medium' | 'low';
  tags: string[];
  updatedAt?: string;
};

const statusOrder: Task['status'][] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

export default function MyTasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState<Task['priority']>('medium');
  const [statusFilter, setStatusFilter] = useState<'all' | Task['status']>('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/tasks');
      const data = await res.json();
      const mine = (Array.isArray(data) ? data : [])
        .filter((t: any) => Array.isArray(t.tags) && t.tags.includes('my-task'));
      setTasks(mine);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (statusFilter === 'all') return tasks;
    return tasks.filter(t => t.status === statusFilter);
  }, [tasks, statusFilter]);

  const createTask = async () => {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          status: 'backlog',
          priority,
          tags: ['my-task', 'manual'],
        }),
      });
      if (res.ok) {
        setTitle('');
        setDescription('');
        await load();
      }
    } finally {
      setSaving(false);
    }
  };

  const moveStatus = async (taskId: string, next: Task['status']) => {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    });
    await load();
  };

  return (
    <div className="h-full overflow-y-auto pr-2 pb-6 space-y-4">
      <div className="glass rounded-2xl p-6 space-y-3">
        <h2 className="text-lg font-semibold">My Tasks</h2>
        <p className="text-xs text-slate-500">Create personal/manual tasks that are separate from agent-generated work.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Task title"
            className="md:col-span-2 glass-sm px-3 py-2 text-sm text-slate-200 outline-none"
          />
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value as Task['priority'])}
            className="glass-sm px-3 py-2 text-sm text-slate-200 outline-none"
          >
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional details"
          className="w-full glass-sm px-3 py-2 text-sm text-slate-200 outline-none"
        />

        <button
          onClick={createTask}
          disabled={saving || !title.trim()}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 disabled:opacity-50"
        >
          {saving ? 'Creating…' : 'Create My Task'}
        </button>
      </div>

      <div className="glass rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Task List</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="glass-sm px-2 py-1 text-xs text-slate-200 outline-none"
          >
            <option value="all">All statuses</option>
            {statusOrder.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-xs text-slate-500">Loading…</p>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-slate-500">No tasks yet.</p>
        ) : (
          <div className="space-y-2">
            {filtered.map(t => (
              <div key={t.id} className="glass-sm p-3 rounded-xl">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium flex-1">{t.title}</p>
                  <span className="text-[10px] text-slate-400">{t.priority}</span>
                </div>
                {t.description ? <p className="text-xs text-slate-400 mt-1">{t.description}</p> : null}
                <div className="mt-2 flex items-center gap-2">
                  <span className="text-[10px] text-slate-500">{t.status.replace('_', ' ')}</span>
                  <div className="ml-auto flex gap-1">
                    {statusOrder.map(s => (
                      <button
                        key={s}
                        onClick={() => moveStatus(t.id, s)}
                        className={`px-2 py-0.5 rounded text-[10px] ${t.status === s ? 'bg-emerald-500/20 text-emerald-300' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}
                      >
                        {s.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
