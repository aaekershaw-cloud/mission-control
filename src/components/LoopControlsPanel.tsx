'use client';

import { useEffect, useState } from 'react';

type LoopControls = {
  maxTodoPerAgent: number;
  maxReviewPerContentCategory: number;
  stagingBlockThresholdPerCategory: number;
};

export default function LoopControlsPanel() {
  const [data, setData] = useState<LoopControls>({
    maxTodoPerAgent: 2,
    maxReviewPerContentCategory: 3,
    stagingBlockThresholdPerCategory: 6,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/loop-controls')
      .then(r => r.json())
      .then(d => setData(d))
      .catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    setSaved(null);
    try {
      const res = await fetch('/api/loop-controls', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) setSaved('Saved');
      else setSaved('Failed');
    } catch {
      setSaved('Failed');
    } finally {
      setSaving(false);
      setTimeout(() => setSaved(null), 2000);
    }
  };

  return (
    <div className="glass rounded-2xl p-6 space-y-4">
      <h3 className="text-sm font-semibold text-slate-200">Loop Controls</h3>
      <p className="text-xs text-slate-500">Tune autonomous throughput limits without redeploying.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="text-xs text-slate-400">
          Max TODO per agent
          <input
            type="number"
            min={1}
            max={10}
            value={data.maxTodoPerAgent}
            onChange={(e) => setData({ ...data, maxTodoPerAgent: Number(e.target.value) })}
            className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none"
          />
        </label>

        <label className="text-xs text-slate-400">
          Max review per content category
          <input
            type="number"
            min={1}
            max={20}
            value={data.maxReviewPerContentCategory}
            onChange={(e) => setData({ ...data, maxReviewPerContentCategory: Number(e.target.value) })}
            className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none"
          />
        </label>

        <label className="text-xs text-slate-400">
          Staging block threshold per category
          <input
            type="number"
            min={1}
            max={50}
            value={data.stagingBlockThresholdPerCategory}
            onChange={(e) => setData({ ...data, stagingBlockThresholdPerCategory: Number(e.target.value) })}
            className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none"
          />
        </label>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save Loop Controls'}
        </button>
        {saved && <span className="text-xs text-slate-400">{saved}</span>}
      </div>
    </div>
  );
}
