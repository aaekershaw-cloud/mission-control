'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, X, ChevronRight, Rocket, Users } from 'lucide-react';
import { Agent, Squad } from '@/types';
import StatusBadge from './StatusBadge';

interface SquadDesignerProps {
  agents: Agent[];
  squads: Squad[];
  onCreateSquad: (squad: {
    name: string;
    description: string;
    leadAgentId: string | null;
    agentIds: string[];
  }) => void;
}

export default function SquadDesigner({
  agents,
  squads,
  onCreateSquad,
}: SquadDesignerProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedAgents, setSelectedAgents] = useState<string[]>([]);
  const [leadAgent, setLeadAgent] = useState<string | null>(null);

  const availableAgents = agents.filter((a) => !selectedAgents.includes(a.id));
  const squadAgents = agents.filter((a) => selectedAgents.includes(a.id));

  function addAgent(id: string) {
    setSelectedAgents((prev) => [...prev, id]);
    if (selectedAgents.length === 0) setLeadAgent(id);
  }

  function removeAgent(id: string) {
    setSelectedAgents((prev) => prev.filter((a) => a !== id));
    if (leadAgent === id) {
      const remaining = selectedAgents.filter((a) => a !== id);
      setLeadAgent(remaining.length > 0 ? remaining[0] : null);
    }
  }

  function handleDeploy() {
    if (!name.trim()) return;
    onCreateSquad({
      name: name.trim(),
      description: description.trim(),
      leadAgentId: leadAgent,
      agentIds: selectedAgents,
    });
    setName('');
    setDescription('');
    setSelectedAgents([]);
    setLeadAgent(null);
  }

  return (
    <div className="space-y-6">
      {/* Existing squads */}
      {squads.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2">
            <Shield size={16} className="text-purple-400" />
            Active Squads
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {squads.map((squad) => (
              <div key={squad.id} className="glass-sm p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-200">
                    {squad.name}
                  </h4>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full ${
                      squad.status === 'active'
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : squad.status === 'paused'
                        ? 'bg-amber-500/15 text-amber-400'
                        : 'bg-slate-500/15 text-slate-400'
                    }`}
                  >
                    {squad.status}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mb-2">{squad.description}</p>
                <div className="flex items-center gap-1">
                  <Users size={12} className="text-slate-500" />
                  <span className="text-xs text-slate-500">
                    {squad.agentIds.length} agents
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create new squad */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-slate-200 mb-4 flex items-center gap-2">
          <Plus size={16} className="text-emerald-400" />
          Create New Squad
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Squad Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alpha Strike Team"
              className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Squad mission and objectives..."
              rows={2}
              className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-emerald-500/30 transition-colors"
            />
          </div>

          {/* Agent selection */}
          <div className="grid grid-cols-2 gap-4">
            {/* Available */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 block">
                Available Agents
              </label>
              <div className="glass-sm p-2 space-y-1 max-h-[240px] overflow-y-auto min-h-[120px]">
                {availableAgents.map((agent) => (
                  <motion.button
                    key={agent.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    onClick={() => addAgent(agent.id)}
                    className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-white/5 transition-colors text-left"
                  >
                    <span className="text-lg">{agent.avatar}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-300 truncate">
                        {agent.name}
                      </p>
                      <p className="text-[10px] text-slate-500">{agent.role}</p>
                    </div>
                    <StatusBadge status={agent.status} size="sm" />
                    <ChevronRight size={12} className="text-slate-600" />
                  </motion.button>
                ))}
                {availableAgents.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">
                    All agents assigned
                  </p>
                )}
              </div>
            </div>

            {/* Selected */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium mb-2 block">
                Squad Formation ({selectedAgents.length})
              </label>
              <div className="glass-sm p-2 space-y-1 max-h-[240px] overflow-y-auto min-h-[120px]">
                <AnimatePresence>
                  {squadAgents.map((agent) => (
                    <motion.div
                      key={agent.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -8 }}
                      className="flex items-center gap-2 p-2 rounded-lg bg-white/5"
                    >
                      <span className="text-lg">{agent.avatar}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-slate-300 truncate">
                          {agent.name}
                        </p>
                        {leadAgent === agent.id && (
                          <span className="text-[10px] text-amber-400 font-medium">
                            Lead
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => removeAgent(agent.id)}
                        className="p-1 rounded-md text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
                {squadAgents.length === 0 && (
                  <p className="text-xs text-slate-600 text-center py-4">
                    Add agents from the left
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Lead selector */}
          {selectedAgents.length > 0 && (
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                Lead Agent
              </label>
              <select
                value={leadAgent || ''}
                onChange={(e) => setLeadAgent(e.target.value || null)}
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none bg-transparent"
              >
                {squadAgents.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900">
                    {a.avatar} {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Deploy */}
          <button
            onClick={handleDeploy}
            disabled={!name.trim() || selectedAgents.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
          >
            <Rocket size={16} />
            Deploy Squad
          </button>
        </div>
      </div>
    </div>
  );
}
