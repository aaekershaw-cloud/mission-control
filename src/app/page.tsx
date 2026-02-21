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
import AgentFormModal from '@/components/AgentFormModal';
import SquadDesigner from '@/components/SquadDesigner';
import CommandPalette from '@/components/CommandPalette';
import ProviderConfig from '@/components/ProviderConfig';
import LoopControlsPanel from '@/components/LoopControlsPanel';
import dynamic from 'next/dynamic';

// Dynamic imports for the new pages to avoid SSR issues
const CalendarPage = dynamic(() => import('./calendar/page'), { ssr: false });
const MemoryPage = dynamic(() => import('./memory/page'), { ssr: false });
const ContentPage = dynamic(() => import('./content/page'), { ssr: false });
const ActivityPage = dynamic(() => import('./activity/page'), { ssr: false });
const StripeDashboardPage = dynamic(() => import('./stripe-dashboard/page'), { ssr: false });
const MyTasksPage = dynamic(() => import('./my-tasks/page'), { ssr: false });

type TabId = 'dashboard' | 'agents' | 'tasks' | 'my-tasks' | 'calendar' | 'memory' | 'content' | 'activity' | 'stripe-dashboard' | 'comms' | 'analytics' | 'squads' | 'config';

const TAB_TITLES: Record<TabId, string> = {
  dashboard: 'Command Center',
  agents: 'Agent Fleet',
  tasks: 'Mission Board',
  'my-tasks': 'My Tasks',
  calendar: 'Calendar',
  memory: 'Memory Browser',
  content: 'Social Media',
  activity: 'Activity Feed',
  'stripe-dashboard': 'Revenue Dashboard',
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
  const [agentFormOpen, setAgentFormOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

      setAgents(agentsData || []);
      setTasks(tasksData || []);
      setMessages(messagesData || []);
      setSquads(squadsData || []);
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
        if (!agentFormOpen) {
          setSelectedAgent(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [agentFormOpen]);

  const handleNewAgent = () => {
    setAgentFormOpen(true);
  };

  const handleCreateAgent = async (agentData: {
    name: string;
    codename: string;
    avatar: string;
    role: string;
    personality: string;
    soul: string;
    provider: string;
    model: string;
  }) => {
    try {
      await fetch('/api/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(agentData),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to create agent:', error);
    }
    setAgentFormOpen(false);
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
      // Don't close modal for status changes, only for full saves
      if ('name' in updatedAgent || 'soul' in updatedAgent) {
        setSelectedAgent(null);
      }
    } catch (error) {
      console.error('Failed to update agent:', error);
    }
  };

  const handleAgentDelete = async (agentId: string) => {
    try {
      await fetch(`/api/agents/${agentId}`, { method: 'DELETE' });
      fetchData();
      setSelectedAgent(null);
    } catch (error) {
      console.error('Failed to delete agent:', error);
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

  const handleUpdateSquad = async (squadId: string, data: Partial<Squad>) => {
    try {
      await fetch(`/api/squads/${squadId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      fetchData();
    } catch (error) {
      console.error('Failed to update squad:', error);
    }
  };

  const handleDisbandSquad = async (squadId: string) => {
    try {
      await fetch(`/api/squads/${squadId}`, { method: 'DELETE' });
      fetchData();
    } catch (error) {
      console.error('Failed to disband squad:', error);
    }
  };

  const handleNavigate = (tab: string, itemId?: string) => {
    setActiveTab(tab as TabId);
    if (tab === 'agents' && itemId) {
      const agent = agents.find(a => a.id === itemId);
      if (agent) setSelectedAgent(agent);
    }
  };

  const handleCommand = (command: string) => {
    setCommandPaletteOpen(false);
    const cmd = command.replace('tab:', '').replace('create:', 'new-').replace('toggle:', 'toggle-');
    switch (cmd) {
      case 'dashboard': case 'agents': case 'tasks': case 'my-tasks': case 'calendar': case 'memory': case 'content': case 'activity': case 'stripe-dashboard': case 'comms': case 'analytics': case 'squads': case 'config':
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

  // Count unread messages for notification badge
  const unreadCount = messages.filter(m => !m.read).length;

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
                <AgentGrid agents={agents} onAgentClick={setSelectedAgent} onCreateAgent={handleNewAgent} />
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
            <AgentGrid agents={agents} onAgentClick={setSelectedAgent} onCreateAgent={handleNewAgent} />
          </div>
        );
      case 'tasks':
        return <TaskBoard />;
      case 'my-tasks':
        return <MyTasksPage />;
      case 'calendar':
        return <CalendarPage />;
      case 'memory':
        return <MemoryPage />;
      case 'content':
        return <ContentPage />;
      case 'activity':
        return <ActivityPage />;
      case 'stripe-dashboard':
        return <StripeDashboardPage />;
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
              <>
                <div className="glass p-6">
                  <h3 className="text-lg font-semibold mb-4">🔁 Loop Health</h3>
                  {(() => {
                    const lh = (analytics as unknown as Record<string, any>).loopHealth || {};
                    return (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 text-sm">
                        <div><p className="text-slate-500">Cycle Time</p><p className="text-emerald-300 font-semibold">{Math.round((lh.avgCycleMs || 0)/1000)}s</p></div>
                        <div><p className="text-slate-500">Review Wait</p><p className="text-amber-300 font-semibold">{Math.round((lh.avgReviewWaitMs || 0)/1000)}s</p></div>
                        <div><p className="text-slate-500">Auto Approved</p><p className="text-cyan-300 font-semibold">{lh.autoApprovedPct || 0}%</p></div>
                        <div><p className="text-slate-500">Human Revised</p><p className="text-purple-300 font-semibold">{lh.humanRevisedPct || 0}%</p></div>
                        <div><p className="text-slate-500">Dupes Blocked (7d)</p><p className="text-rose-300 font-semibold">{lh.duplicateTaskRate || 0}</p></div>
                        <div><p className="text-slate-500">Throughput Trend</p><p className="text-slate-200 font-semibold">{Array.isArray(lh.tasksCreatedVsCompletedByDay) ? lh.tasksCreatedVsCompletedByDay.length : 0} days</p></div>
                      </div>
                    );
                  })()}
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Tasks by Status */}
                  <div className="glass p-6">
                    <h3 className="text-lg font-semibold mb-4">Tasks by Status</h3>
                    <div className="space-y-3">
                      {Object.entries(analytics.tasksByStatus).map(([status, count]) => {
                        const colors: Record<string, string> = {
                          backlog: 'from-slate-500 to-slate-400',
                          todo: 'from-blue-500 to-blue-400',
                          in_progress: 'from-amber-500 to-amber-400',
                          review: 'from-purple-500 to-purple-400',
                          done: 'from-emerald-500 to-emerald-400',
                        };
                        return (
                          <div key={status} className="flex items-center gap-3">
                            <span className="text-sm text-[#8892a8] w-24 capitalize">{status.replace('_', ' ')}</span>
                            <div className="flex-1 h-3 rounded-full bg-[#0a1128]">
                              <div className={`h-full rounded-full bg-gradient-to-r ${colors[status] || 'from-slate-500 to-slate-400'}`}
                                style={{ width: `${analytics.totalTasks > 0 ? (count / analytics.totalTasks) * 100 : 0}%` }} />
                            </div>
                            <span className="text-sm font-bold w-10 text-right">{count}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* Agent Performance */}
                  <div className="glass p-6">
                    <h3 className="text-lg font-semibold mb-4">Agent Performance</h3>
                    <div className="space-y-3">
                      {(analytics.agentPerformance as Array<{ agentId: string; name: string; avatar: string; tasksCompleted: number; tokensUsed: number; costUsd: number; avgDurationMs?: number; successfulResults?: number; errorResults?: number }>).slice(0, 10).map((agent) => (
                        <div key={agent.agentId} className="flex items-center gap-3">
                          <span className="text-xl">{agent.avatar}</span>
                          <span className="text-sm flex-1 truncate">{agent.name}</span>
                          <span className="text-sm text-emerald-400 font-medium">{agent.tasksCompleted}</span>
                          <span className="text-xs text-slate-500">{(agent.tokensUsed / 1000).toFixed(0)}k</span>
                          <span className="text-xs text-pink-400">${agent.costUsd.toFixed(4)}</span>
                          {agent.avgDurationMs ? (
                            <span className="text-xs text-slate-500">{(agent.avgDurationMs / 1000).toFixed(1)}s</span>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Cost tracking and queue history */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Cost by Day */}
                  <div className="glass p-6">
                    <h3 className="text-lg font-semibold mb-4">💰 Cost by Day (Last 7 Days)</h3>
                    <div className="space-y-2">
                      {((analytics as unknown as Record<string, unknown>).costByDay as Array<{ day: string; cost: number; tokens: number; tasks: number }> || []).map((d) => (
                        <div key={d.day} className="flex items-center gap-3">
                          <span className="text-xs text-slate-500 w-20 font-mono">{d.day.slice(5)}</span>
                          <div className="flex-1 h-2 rounded-full bg-[#0a1128]">
                            <div className="h-full rounded-full bg-gradient-to-r from-pink-500 to-rose-400"
                              style={{ width: `${Math.min(100, d.cost * 5000)}%` }} />
                          </div>
                          <span className="text-xs text-pink-400 font-medium w-16 text-right">${d.cost.toFixed(4)}</span>
                          <span className="text-xs text-slate-500 w-14 text-right">{d.tasks} tasks</span>
                        </div>
                      ))}
                      {!((analytics as unknown as Record<string, unknown>).costByDay as unknown[])?.length && (
                        <p className="text-sm text-slate-500">No cost data yet. Run some tasks!</p>
                      )}
                    </div>
                  </div>

                  {/* Recent Completions */}
                  <div className="glass p-6">
                    <h3 className="text-lg font-semibold mb-4">⚡ Recent Task Completions</h3>
                    <div className="space-y-2 max-h-64 overflow-y-auto">
                      {((analytics as unknown as Record<string, unknown>).recentCompletions as Array<{ id: string; taskTitle: string; agentName: string; agentAvatar: string; tokensUsed: number; costUsd: number; durationMs: number; status: string; createdAt: string }> || []).slice(0, 15).map((r) => (
                        <div key={r.id} className="flex items-center gap-2 text-xs">
                          <span>{r.agentAvatar}</span>
                          <span className="flex-1 truncate text-slate-300">{r.taskTitle}</span>
                          <span className={r.status === 'completed' ? 'text-emerald-400' : 'text-red-400'}>
                            {r.status === 'completed' ? '✓' : '✗'}
                          </span>
                          <span className="text-slate-500">{(r.durationMs / 1000).toFixed(1)}s</span>
                        </div>
                      ))}
                      {!((analytics as unknown as Record<string, unknown>).recentCompletions as unknown[])?.length && (
                        <p className="text-sm text-slate-500">No completions yet.</p>
                      )}
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        );
      case 'squads':
        return (
          <div className="h-full overflow-y-auto pr-2 pb-6">
            <SquadDesigner
              agents={agents}
              squads={squads}
              onCreateSquad={handleCreateSquad}
              onUpdateSquad={handleUpdateSquad}
              onDisbandSquad={handleDisbandSquad}
            />
          </div>
        );
      case 'config':
        return (
          <div className="h-full overflow-y-auto pr-2 pb-6 space-y-4">
            <ProviderConfig onSave={() => { fetchData(); }} />
            <LoopControlsPanel />
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
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
      />
      <div className="flex-1 flex flex-col min-w-0">
        <Header
          title={TAB_TITLES[activeTab]}
          onNewAgent={handleNewAgent}
          onNewTask={handleNewTask}
          messages={messages}
          agents={agents}
          tasks={tasks}
          unreadCount={unreadCount}
          onNavigate={handleNavigate}
          onMarkRead={async (messageId: string) => {
            try {
              await fetch(`/api/messages/${messageId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ read: true }),
              });
              fetchData();
            } catch (error) {
              console.error('Failed to mark message as read:', error);
            }
          }}
          onMenuToggle={() => setMobileMenuOpen(prev => !prev)}
          onMarkAllRead={async () => {
            try {
              const unread = messages.filter(m => !m.read);
              await Promise.all(
                unread.map(m =>
                  fetch(`/api/messages/${m.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ read: true }),
                  })
                )
              );
              fetchData();
            } catch (error) {
              console.error('Failed to mark all messages as read:', error);
            }
          }}
        />
        <main className="flex-1 p-3 md:p-6 min-h-0">
          {renderContent()}
        </main>
      </div>

      {selectedAgent && (
        <AgentDetail
          agent={selectedAgent}
          onClose={() => setSelectedAgent(null)}
          onUpdate={handleAgentUpdate}
          onDelete={handleAgentDelete}
        />
      )}

      {agentFormOpen && (
        <AgentFormModal
          onClose={() => setAgentFormOpen(false)}
          onSave={handleCreateAgent}
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
