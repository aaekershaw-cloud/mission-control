'use client';

import { useState, useEffect } from 'react';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import { Plus, Filter, X, Calendar, User, Image, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';

interface ContentItem {
  id: string;
  title: string;
  body: string;
  stage: string;
  platform: string;
  assigned_agent_id: string | null;
  agent_name?: string;
  agent_avatar?: string;
  thumbnail_url: string | null;
  publish_date: string | null;
  notes: string;
  tags: string[];
  metadata: any;
  created_at: string;
  updated_at: string;
}

const STAGES = [
  { id: 'idea', label: '💡 Ideas', color: 'from-purple-500 to-purple-400' },
  { id: 'writing', label: '📝 Writing', color: 'from-blue-500 to-blue-400' },
  { id: 'review', label: '👀 Review', color: 'from-yellow-500 to-yellow-400' },
  { id: 'assets', label: '🎨 Assets', color: 'from-pink-500 to-pink-400' },
  { id: 'scheduled', label: '📅 Scheduled', color: 'from-orange-500 to-orange-400' },
  { id: 'published', label: '✅ Published', color: 'from-green-500 to-green-400' },
];

const PLATFORMS = [
  { id: 'x', label: 'X/Twitter', icon: '𝕏', color: 'bg-black' },
  { id: 'instagram', label: 'Instagram', icon: '📷', color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', color: 'bg-black' },
  { id: 'youtube', label: 'YouTube', icon: '📺', color: 'bg-red-600' },
  { id: 'blog', label: 'Blog', icon: '✍️', color: 'bg-slate-600' },
];

export default function ContentPipelinePage() {
  const [content, setContent] = useState<ContentItem[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterPlatform, setFilterPlatform] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createStage, setCreateStage] = useState<string>('idea');
  const [selectedContent, setSelectedContent] = useState<ContentItem | null>(null);
  const [draggedItem, setDraggedItem] = useState<ContentItem | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchContent = async () => {
    setLoading(true);
    try {
      const url = filterPlatform 
        ? `/api/content-pipeline?platform=${filterPlatform}`
        : '/api/content-pipeline';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setContent(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch content:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAgents = async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data || []);
      }
    } catch (error) {
      console.error('Failed to fetch agents:', error);
    }
  };

  useEffect(() => {
    fetchContent();
    fetchAgents();
  }, [filterPlatform]);

  const updateContentStage = async (contentId: string, newStage: string) => {
    try {
      await fetch('/api/content-pipeline', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: contentId, stage: newStage }),
      });
      fetchContent();
    } catch (error) {
      console.error('Failed to update content stage:', error);
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const item = content.find(c => c.id === event.active.id);
    if (item) setDraggedItem(item);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // If dropped over a stage column
    if (STAGES.some(stage => stage.id === overId)) {
      const item = content.find(c => c.id === activeId);
      if (item && item.stage !== overId) {
        setContent(prev => 
          prev.map(c => c.id === activeId ? { ...c, stage: overId } : c)
        );
      }
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    const draggedContent = draggedItem;
    setDraggedItem(null);

    if (!over || !draggedContent) return;

    const overId = over.id as string;
    
    // Update in database if stage changed
    if (STAGES.some(stage => stage.id === overId) && draggedContent.stage !== overId) {
      updateContentStage(draggedContent.id, overId);
    }
  };

  const getContentByStage = (stageId: string) => {
    return content.filter(c => c.stage === stageId);
  };

  const getPlatformConfig = (platformId: string) => {
    return PLATFORMS.find(p => p.id === platformId) || PLATFORMS[4]; // default to blog
  };

  const handleCreateContent = async (contentData: Partial<ContentItem>) => {
    try {
      await fetch('/api/content-pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contentData),
      });
      fetchContent();
      setShowCreateModal(false);
    } catch (error) {
      console.error('Failed to create content:', error);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-white">📝 Content Pipeline</h1>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
              showFilters ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-white/10 hover:border-white/20'
            }`}
          >
            <Filter size={14} />
            Filters
          </button>
          {filterPlatform && (
            <div className="text-sm text-slate-400">
              Filtered by: {getPlatformConfig(filterPlatform).label}
              <button
                onClick={() => setFilterPlatform('')}
                className="ml-2 text-slate-500 hover:text-slate-300"
              >
                <X size={14} />
              </button>
            </div>
          )}
        </div>

        <button
          onClick={() => {
            setCreateStage('idea');
            setShowCreateModal(true);
          }}
          className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-all"
        >
          <Plus size={18} />
          New Idea
        </button>
      </div>

      {/* Platform Filter */}
      {showFilters && (
        <div className="mb-4 p-3 bg-white/5 border border-white/10 rounded-xl">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm text-slate-300">Platform:</span>
            {PLATFORMS.map(platform => (
              <button
                key={platform.id}
                onClick={() => setFilterPlatform(filterPlatform === platform.id ? '' : platform.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                  filterPlatform === platform.id
                    ? 'text-white border-white/30 bg-white/10'
                    : 'text-slate-400 border-white/10 hover:border-white/20'
                }`}
              >
                {platform.icon} {platform.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto">
        <div className="flex gap-4 h-full min-w-max">
          <DndContext
            sensors={sensors}
            collisionDetection={closestCorners}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDragEnd={handleDragEnd}
          >
            {STAGES.map((stage) => {
              const stageContent = getContentByStage(stage.id);
              return (
                <div key={stage.id} className="w-80 flex flex-col">
                  {/* Column Header */}
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-white">{stage.label}</h3>
                      <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs text-slate-300">
                        {stageContent.length}
                      </span>
                    </div>
                    {stage.id === 'idea' && (
                      <button
                        onClick={() => {
                          setCreateStage(stage.id);
                          setShowCreateModal(true);
                        }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-all"
                      >
                        <Plus size={16} />
                      </button>
                    )}
                  </div>

                  {/* Drop Zone */}
                  <div
                    id={stage.id}
                    className="flex-1 min-h-[500px] bg-white/5 border border-white/10 rounded-xl p-3 space-y-3"
                  >
                    {stageContent.map((item) => (
                      <ContentCard
                        key={item.id}
                        content={item}
                        onClick={() => setSelectedContent(item)}
                        platforms={PLATFORMS}
                      />
                    ))}
                    
                    {stageContent.length === 0 && (
                      <div className="flex items-center justify-center h-32 text-slate-500 text-sm">
                        No content in {stage.label.toLowerCase()}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            <DragOverlay>
              {draggedItem ? (
                <ContentCard content={draggedItem} platforms={PLATFORMS} isDragging />
              ) : null}
            </DragOverlay>
          </DndContext>
        </div>
      </div>

      {/* Modals */}
      {showCreateModal && (
        <CreateContentModal
          stage={createStage}
          agents={agents}
          platforms={PLATFORMS}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateContent}
        />
      )}

      {selectedContent && (
        <ContentDetailModal
          content={selectedContent}
          agents={agents}
          platforms={PLATFORMS}
          onClose={() => setSelectedContent(null)}
          onUpdate={fetchContent}
        />
      )}
    </div>
  );
}

// Content Card Component
function ContentCard({
  content,
  platforms,
  onClick,
  isDragging = false
}: {
  content: ContentItem;
  platforms: typeof PLATFORMS;
  onClick?: () => void;
  isDragging?: boolean;
}) {
  const platform = platforms.find(p => p.id === content.platform) || platforms[4];

  return (
    <div
      onClick={onClick}
      className={`p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer transition-all hover:border-white/20 ${
        isDragging ? 'opacity-50 rotate-2' : ''
      }`}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-2">
        <h4 className="font-medium text-white text-sm line-clamp-2 flex-1">
          {content.title}
        </h4>
        <div className={`px-2 py-1 rounded text-xs text-white ml-2 ${platform.color}`}>
          {platform.icon}
        </div>
      </div>

      {/* Body preview */}
      {content.body && (
        <p className="text-slate-300 text-xs line-clamp-3 mb-3">
          {content.body}
        </p>
      )}

      {/* Tags */}
      {content.tags && content.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {content.tags.slice(0, 3).map((tag, index) => (
            <span key={index} className="px-1.5 py-0.5 bg-white/10 rounded text-xs text-slate-300">
              {tag}
            </span>
          ))}
          {content.tags.length > 3 && (
            <span className="text-xs text-slate-500">+{content.tags.length - 3}</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-2">
          {content.agent_avatar && (
            <span title={content.agent_name}>
              {content.agent_avatar}
            </span>
          )}
          <span>{format(new Date(content.created_at), 'MMM d')}</span>
        </div>
        
        {content.publish_date && (
          <div className="flex items-center gap-1">
            <Calendar size={12} />
            <span>{format(new Date(content.publish_date), 'MMM d')}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// Create Content Modal (simplified version)
function CreateContentModal({
  stage,
  agents,
  platforms,
  onClose,
  onCreate
}: {
  stage: string;
  agents: any[];
  platforms: typeof PLATFORMS;
  onClose: () => void;
  onCreate: (data: any) => void;
}) {
  const [formData, setFormData] = useState({
    title: '',
    body: '',
    platform: 'blog',
    assigned_agent_id: '',
    tags: [] as string[],
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreate({
      ...formData,
      stage,
      tags: formData.tags,
    });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">Create Content</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Title *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400"
              placeholder="Content title"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Platform
              </label>
              <select
                value={formData.platform}
                onChange={(e) => setFormData(prev => ({ ...prev, platform: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              >
                {platforms.map(platform => (
                  <option key={platform.id} value={platform.id} className="bg-slate-900">
                    {platform.icon} {platform.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-1">
                Assigned Agent
              </label>
              <select
                value={formData.assigned_agent_id}
                onChange={(e) => setFormData(prev => ({ ...prev, assigned_agent_id: e.target.value }))}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white"
              >
                <option value="" className="bg-slate-900">No agent</option>
                {agents.map(agent => (
                  <option key={agent.id} value={agent.id} className="bg-slate-900">
                    {agent.avatar} {agent.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Content/Script
            </label>
            <textarea
              value={formData.body}
              onChange={(e) => setFormData(prev => ({ ...prev, body: e.target.value }))}
              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white placeholder-slate-400 resize-none"
              rows={6}
              placeholder="Write your content here..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-white/10 rounded-lg text-slate-300 hover:bg-white/5 transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-amber-500 text-black rounded-lg font-medium hover:bg-amber-400 transition-all"
            >
              Create Content
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Content Detail Modal (placeholder - similar structure to create modal)
function ContentDetailModal({
  content,
  agents,
  platforms,
  onClose,
  onUpdate
}: {
  content: ContentItem;
  agents: any[];
  platforms: typeof PLATFORMS;
  onClose: () => void;
  onUpdate: () => void;
}) {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-semibold text-white">{content.title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
          >
            <X size={18} />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <h4 className="font-medium text-white mb-2">Content</h4>
            <div className="p-4 bg-white/5 rounded-lg">
              <pre className="whitespace-pre-wrap text-slate-300 text-sm">
                {content.body || 'No content yet'}
              </pre>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-slate-400">Platform:</span>
              <span className="ml-2 text-white">
                {platforms.find(p => p.id === content.platform)?.label || content.platform}
              </span>
            </div>
            <div>
              <span className="text-slate-400">Stage:</span>
              <span className="ml-2 text-white">{content.stage}</span>
            </div>
            {content.publish_date && (
              <div>
                <span className="text-slate-400">Publish Date:</span>
                <span className="ml-2 text-white">
                  {format(new Date(content.publish_date), 'MMM d, yyyy')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}