'use client';

import { useState, useEffect } from 'react';
import { RefreshCw, Filter, User, Briefcase, Share2, DollarSign, Zap, FileText, CheckCircle, XCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Activity {
  id: string;
  event_type: string;
  title: string;
  description: string;
  agent_id: string | null;
  agent_name?: string;
  agent_avatar?: string;
  metadata: any;
  created_at: string;
}

const EVENT_TYPES = [
  { id: 'all', label: 'All Events', icon: FileText, color: 'text-slate-400' },
  { id: 'agent', label: 'Agent Tasks', icon: User, color: 'text-blue-400' },
  { id: 'content', label: 'Content Pipeline', icon: Briefcase, color: 'text-orange-400' },
  { id: 'social', label: 'Social Posts', icon: Share2, color: 'text-pink-400' },
  { id: 'stripe', label: 'Revenue', icon: DollarSign, color: 'text-emerald-400' },
  { id: 'system', label: 'System', icon: Zap, color: 'text-purple-400' },
];

const EVENT_ICONS = {
  agent: { icon: User, color: 'text-blue-400 bg-blue-400/10' },
  content: { icon: Briefcase, color: 'text-orange-400 bg-orange-400/10' },
  social: { icon: Share2, color: 'text-pink-400 bg-pink-400/10' },
  stripe: { icon: DollarSign, color: 'text-emerald-400 bg-emerald-400/10' },
  system: { icon: Zap, color: 'text-purple-400 bg-purple-400/10' },
  review: { icon: CheckCircle, color: 'text-amber-400 bg-amber-400/10' },
  deploy: { icon: Zap, color: 'text-cyan-400 bg-cyan-400/10' },
};

export default function ActivityFeedPage() {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('all');
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchActivities = async () => {
    setLoading(true);
    try {
      const typeParam = filterType !== 'all' ? `?type=${filterType}` : '';
      const res = await fetch(`/api/activity${typeParam}`);
      if (res.ok) {
        const data = await res.json();
        setActivities(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch activities:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, [filterType]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!autoRefresh) return;

    const interval = setInterval(fetchActivities, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, filterType]);

  const getEventIcon = (eventType: string) => {
    const config = EVENT_ICONS[eventType as keyof typeof EVENT_ICONS] || EVENT_ICONS.system;
    const Icon = config.icon;
    return { Icon, color: config.color };
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
      case 'success':
      case 'approved':
        return <CheckCircle size={14} className="text-emerald-400" />;
      case 'failed':
      case 'error':
      case 'rejected':
        return <XCircle size={14} className="text-red-400" />;
      case 'started':
      case 'in_progress':
        return <div className="w-3.5 h-3.5 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />;
      default:
        return null;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">📊 Activity Feed</h1>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <div className={`w-2 h-2 rounded-full ${autoRefresh ? 'bg-emerald-400' : 'bg-slate-600'}`} />
            <span>Auto-refresh {autoRefresh ? 'on' : 'off'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              autoRefresh 
                ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' 
                : 'text-slate-400 border-white/10 hover:border-white/20'
            }`}
          >
            Auto-refresh
          </button>
          <button
            onClick={fetchActivities}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-slate-300 hover:bg-white/10 transition-all disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={16} className="text-slate-400" />
          <span className="text-sm text-slate-300">Filter:</span>
          {EVENT_TYPES.map((type) => {
            const Icon = type.icon;
            const isActive = filterType === type.id;
            return (
              <button
                key={type.id}
                onClick={() => setFilterType(type.id)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  isActive
                    ? 'text-white border-white/30 bg-white/10'
                    : 'text-slate-400 border-white/10 hover:border-white/20 hover:text-slate-300'
                }`}
              >
                <Icon size={12} className={type.color} />
                {type.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Activity Feed */}
      <div className="flex-1 overflow-y-auto">
        {loading && activities.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-slate-500">Loading activities...</div>
          </div>
        ) : activities.length === 0 ? (
          <div className="flex items-center justify-center h-32">
            <div className="text-center">
              <FileText size={48} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400">No activities found</p>
              <p className="text-slate-500 text-sm">Activity will appear here as the system runs</p>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => {
              const { Icon, color } = getEventIcon(activity.event_type);
              const timeAgo = formatDistanceToNow(new Date(activity.created_at), { addSuffix: true });

              return (
                <div key={activity.id} className="p-4 bg-white/5 border border-white/10 rounded-xl hover:border-white/20 transition-all">
                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div className={`p-2 rounded-lg ${color}`}>
                      <Icon size={16} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="text-white font-medium text-sm">{activity.title}</h3>
                            {activity.metadata?.status && getStatusIcon(activity.metadata.status)}
                          </div>
                          
                          {activity.description && (
                            <p className="text-slate-300 text-sm line-clamp-2">
                              {activity.description}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                            <span>{timeAgo}</span>
                            {activity.agent_name && (
                              <span className="flex items-center gap-1">
                                {activity.agent_avatar} {activity.agent_name}
                              </span>
                            )}
                            {activity.metadata?.duration && (
                              <span>{activity.metadata.duration}</span>
                            )}
                            {activity.metadata?.cost && (
                              <span className="text-emerald-400">
                                ${activity.metadata.cost}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Metadata badges */}
                        <div className="flex items-center gap-1">
                          {activity.metadata?.priority && (
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              activity.metadata.priority === 'critical' ? 'bg-red-500/20 text-red-300' :
                              activity.metadata.priority === 'high' ? 'bg-orange-500/20 text-orange-300' :
                              activity.metadata.priority === 'medium' ? 'bg-amber-500/20 text-amber-300' :
                              'bg-blue-500/20 text-blue-300'
                            }`}>
                              {activity.metadata.priority}
                            </span>
                          )}
                          
                          {activity.metadata?.platform && (
                            <span className="px-2 py-0.5 bg-pink-500/20 text-pink-300 rounded text-xs font-medium">
                              {activity.metadata.platform}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}