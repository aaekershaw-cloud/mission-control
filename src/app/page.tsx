'use client';

import { useState, useEffect, useCallback } from 'react';
import { Agent, Task, Message, Squad, AnalyticsData } from '@/types';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import MetricsPanel from '@/components/MetricsPanel';
import AgentGrid from '@/components/AgentGrid';
import TaskBoard from '@/components/TaskBoard';
import ActivityFeed from '@/components/ActivityFeed';
import HeartbeatMonitor from '@/components/HeartbeatMonitor';
import AgentDetail from '@/components/AgentDetail';
import SquadDesigner from '@/components/SquadDesigner';
import CommandPalette from '@/components/CommandPalette';
import ProviderConfig from '@/components/ProviderConfig';

type TabId = 'dashboard' | 'agents' | 'tasks' | 'comms' | 'analytics' | 'squads' | 'config';

const TAB_TITLES: Record<TabId, string> = {
  dashboard: 'Command Center',
  agents: 'Agent Fleet',
  tasks: 'Mission Board',
  comms: 'Comms Center',
  analytics: 'Analytics',
  squads: 'Squad Operations',
  config: 'Configuration',
};

export default function MissionControl() {
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [squads, setSquads] = useState<Squad[]>([]);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [agentsRes, tasksRes, messagesRes, squadsRes, analyticsRes] = await Promise.all([
        fetch('/api/agents'),
        fetch('/api/tasks'),
        fetch('/api/messages'),
        fetch('/api/squads'),
        fetch('/api/analytics'),
      ]);

      const [agentsData, tasksData, messagesData, squadsData, analyticsData] = await Promise.all([
        agentsRes.json(),
        tasksRes.json(),
        messagesRes.json(),
        squadsRes.json(),
        analyticsRes.json(),
      ]);

      setAgents(agentsData);
      setTasks(tasksData);
      setMessages(messagesData);
      setSquads(squadsData);
      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Keyboard shortcut for command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(prev => !prev);
      }
      if (e.key === 'Escape') {
        setCommandPaletteOpen(false);
        setSelectedAgent(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleNewAgent = async () => {
    const name = prompt('Agent name:');
    if (!name) return;
    const role = prompt('Agent role:') || 'General Purpose';
    const codename = name.toUpperCase().replace(/\s+/g, '-');

    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          codename,
          role,
          avatar: '🤖',
          personality: '',
          soul: `# ${codename}\\n\\nYou are ${name}, a ${role}.`,
          provider: 'kimi-k2.5',
          model: 'moonshotai/kimi-k2.5',
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
  };

  const handleNewTask = async () => {
    const title = prompt('Task title:');
    if (!title) return;
    const description = prompt('Task description:') || '';

    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
          status: 'backlog',
          priority: 'medium',
          tags: [],
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create task:', error);
    }
  };

  const handleSendMessage = async (content: string) => {
    if (!agents.length) return;
    try {
      await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromAgentId: agents[0].id,
          content,
          type: 'message',
        }),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to send message:', error);
    }
  };

  const handleAgentUpdate = async (updatedAgent: Partial<Agent> & { id: string }) => {
    try {
      await fetch(`/api/agents/${updatedAgent.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedAgent),
      });
      fetchData();
      setSelectedAgent(null);
    } catch (error) {
      console.error('Failed to update agent:', error);
    }
  };

  const handleCreateSquad = async (squad: { name: string; description: string; agentIds: string[]; leadAgentId: string | null }) => {
    try {
      await fetch('/api/squads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(squad),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create squad:', error);
    }
  };

  const handleCommand = (command: string) => {
    setCommandPaletteOpen(false);
    // Handle both "tab:dashboard" and "dashboard" formats
    const cmd = command.replace('tab:', '').replace('create:', 'new-').replace('toggle:', 'toggle-');
    switch (cmd) {
      case 'dashboard': case 'agents': case 'tasks': case 'comms': case 'analytics': case 'squads': case 'config':
        setActiveTab(cmd);
        break;
      case 'new-agent':
        handleNewAgent();
        break;
      case 'new-task':
        handleNewTask();
        break;
      case 'new-squad':
        setActiveTab('squads');
        break;
      case 'toggle-sidebar':
        setSidebarCollapsed(prev => !prev);
        break;
      case 'refresh':
        fetchData();
        break;
    }
  };

  const metrics = analytics ? {
    totalAgents: analytics.totalAgents,
    activeAgents: analytics.activeAgents,
    totalTasks: analytics.totalTasks,
    completedTasks: analytics.completedTasks,
    totalTokens: analytics.totalTokens,
    totalCost: analytics.totalCost,
  } : {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.status === 'online' || a.status === 'busy').length,
    totalTasks: tasks.length,
    completedTasks: tasks.filter(t => t.status === 'done').length,
    totalTokens: agents.reduce((sum, a) => sum + a.tokensUsed, 0),
    totalCost: agents.reduce((sum, a) => sum + a.costUsd, 0),
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full border-2 border-[#4cc9f0] border-t-transparent animate-spin" />
            <p className="text-[#8892a8] text-lg">Initializing Mission Control...</p>
          </div>
        </div>
      );
    }

    switch (activeTab) {
      case 'dashboard':
        return (
          <div className="space-y-6 h-full overflow-y-auto pr-2 pb-6">
            <MetricsPanel metrics={metrics} />
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
              <div className="xl:col-span-2">
                <AgentGrid agents={agents} onAgentClick={setSelectedAgent} />
              </div>
              <div className="space-y-6">
                <HeartbeatMonitor agents={agents} />
                <ActivityFeed messages={messages.slice(0, 8)} onSendMessage={handleSendMessage} compact />
              </div>
            </div>
          </div>
        );
      case 'agents':
        return (
          <div className="h-full overflow-y-auto pr-2 pb-6">
            <AgentGrid agents={agents} onAgentClick={setSelectedAgent} />
          </div>
        );
      case 'tasks':
        return <TaskBoard />;
      case 'comms':
        return (
          <div className="h-full">
            <ActivityFeed messages={messages} onSendMessage={handleSendMessage} />
          </div>
        );
      case 'analytics':
        return (
          <div className="space-y-6 h-full overflow-y-auto pr-2 pb-6">
            <MetricsPanel metrics={metrics} />
            {analytics && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="glass p-6">
                  <h3 className="text-lg font-semibold mb-4">Tasks by Status</h3>
                  <div className="space-y-3">
                    {Object.entries(analytics.tasksByStatus).map(([status, count]) => (
                      <div key={status} className="flex items-center gap-3">
                        <span className="text-sm text-[#8892a8] w-24 capitalize">{status.replace('_', ' ')}</span>
                        <div className="flex-1 h-2 rounded-full bg-[#0a1128]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-[#06d6a0] to-[#4cc9f0]"
                            style={{ width: `${analytics.totalTasks > 0 ? (count / analytics.totalTasks) * 100 : 0}%` }}
                          />
                        </div>
                        <span className="text-sm font-medium w-8 text-right">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="glass p-6">
                  <h3 className="text-lg font-semibold mb-4">Agent Performance</h3>
                  <div className="space-y-3">
                    {analytics.agentPerformance.slice(0, 8).map((agent) => (
                      <div key={agent.agentId} className="flex items-center gap-3">
                        <span className="text-xl">{agent.avatar}</span>
                        <span className="text-sm flex-1">{agent.name}</span>
                        <span className="text-sm text-[#06d6a0] font-medium">{agent.tasksCompleted} tasks</span>
                        <span className="text-sm text-[#8892a8]">{(agent.tokensUsed / 1000).toFixed(0)}k tokens</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      case 'squads':
        return (
          <div className="h-full overflow-y-auto pr-2 pb-6">
            <SquadDesigner agents={agents} squads={squads} onCreateSquad={handleCreateSquad} />
          </div>
        );
      case 'config':
        return (
          <div className="h-full overflow-y-auto pr-2 pb-6">
            <ProviderConfig onSave={() => { fetchData(); }} />
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-screen">
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabId)}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(prev => !prev)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={TAB_TITLES[activeTab]}
          onNewAgent={handleNewAgent}
          onNewTask={handleNewTask}
        />
        <main className="flex-1 p-6 min-h-0">
          {renderContent()}
        </main>
      </div>

      {selectedAgent && (
        <AgentDetail
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onUpdate={handleAgentUpdate}
        />
      )}

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onCommand={handleCommand}
      />
    </div>
  );
}
