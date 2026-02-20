'use client';

import React, { useState, useEffect, useRef } from 'react';
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
import { Plus, Filter, X, Calendar, User, Image, ExternalLink, Upload } from 'lucide-react';
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
  { id: 'writing', label: '✏️ Drafting', color: 'from-blue-500 to-blue-400' },
  { id: 'review', label: '👀 Review', color: 'from-yellow-500 to-yellow-400' },
  { id: 'scheduled', label: '📅 Scheduled', color: 'from-orange-500 to-orange-400' },
  { id: 'published', label: '✅ Published', color: 'from-green-500 to-green-400' },
];

const PLATFORMS = [
  { id: 'x', label: 'X/Twitter', icon: '𝕏', color: 'bg-black' },
  { id: 'instagram', label: 'Instagram', icon: '📷', color: 'bg-gradient-to-br from-purple-500 to-pink-500' },
  { id: 'tiktok', label: 'TikTok', icon: '🎵', color: 'bg-black' },
  { id: 'youtube', label: 'YouTube', icon: '📺', color: 'bg-red-600' },
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
    return PLATFORMS.find(p => p.id === platformId) || PLATFORMS[0]; // default to X
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
          <h1 className="text-2xl font-bold text-white">📱 Social Media Pipeline</h1>
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
      <div className="flex-1 overflow-x-auto overflow-y-hidden">
        <div className="flex gap-4 h-full min-w-max pb-4">
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
                <div key={stage.id} className="w-80 flex flex-col min-h-0">
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
                    className="flex-1 min-h-[200px] bg-white/5 border border-white/10 rounded-xl p-3 space-y-3 overflow-y-auto"
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

// Image Upload Component
function ImageUploadField({
  currentUrl,
  onUploaded,
}: {
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
}) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl || null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Local preview
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    const form = new FormData();
    form.append('file', file);

    try {
      const res = await fetch('/api/content-pipeline/upload', { method: 'POST', body: form });
      if (res.ok) {
        const { url } = await res.json();
        onUploaded(url);
        setPreview(url);
      } else {
        const err = await res.json();
        alert(err.error || 'Upload failed');
        setPreview(currentUrl || null);
      }
    } catch {
      alert('Upload failed');
      setPreview(currentUrl || null);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div>
      <label className="text-sm font-medium text-slate-400 mb-1 block">Image</label>
      {preview && (
        <img src={preview} alt="" className="w-full max-w-sm rounded-lg border border-white/10 mb-2" />
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleUpload}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => fileRef.current?.click()}
        disabled={uploading}
        className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-slate-300 hover:bg-white/10 transition-all disabled:opacity-50"
      >
        <Upload size={14} />
        {uploading ? 'Uploading...' : preview ? 'Replace Image' : 'Upload Image'}
      </button>
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
  const platform = platforms.find(p => p.id === content.platform) || platforms[0];

  return (
    <div
      onClick={onClick}
      className={`p-4 bg-white/5 border border-white/10 rounded-xl cursor-pointer transition-all hover:border-white/20 ${
        isDragging ? 'opacity-50 rotate-2' : ''
      }`}
    >
      {/* Thumbnail */}
      {content.thumbnail_url && (
        <img src={content.thumbnail_url} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />
      )}

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
    platform: 'instagram',
    assigned_agent_id: '',
    tags: [] as string[],
    notes: '',
    thumbnail_url: '',
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

          <ImageUploadField
            onUploaded={(url) => setFormData(prev => ({ ...prev, thumbnail_url: url }))}
          />

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
  const [editedBody, setEditedBody] = useState(content.body || '');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([content.platform]);
  const [saving, setSaving] = useState(false);
  const [actionInProgress, setActionInProgress] = useState('');
  const isEdited = editedBody !== (content.body || '') || selectedPlatforms[0] !== content.platform || selectedPlatforms.length > 1;

  const togglePlatform = (pid: string) => {
    setSelectedPlatforms(prev => {
      if (prev.includes(pid)) {
        // Don't allow deselecting the last one
        if (prev.length === 1) return prev;
        return prev.filter(p => p !== pid);
      }
      return [...prev, pid];
    });
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  const updateContent = async (updates: Record<string, any>) => {
    await fetch('/api/content-pipeline', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: content.id, ...updates }),
    });
    onUpdate();
  };

  const handleSave = async () => {
    setSaving(true);
    await updateContent({ body: editedBody, platform: selectedPlatforms[0] });
    setSaving(false);
  };

  const handleApprove = async () => {
    setActionInProgress('approve');
    await updateContent({ body: editedBody, platform: selectedPlatforms[0], platforms: selectedPlatforms, stage: 'scheduled' });
    setActionInProgress('');
    onClose();
  };

  const handlePublish = async () => {
    setActionInProgress('publish');
    await updateContent({ body: editedBody, platform: selectedPlatforms[0], platforms: selectedPlatforms, stage: 'published' });
    setActionInProgress('');
    onClose();
  };

  const handleReject = async () => {
    setActionInProgress('reject');
    await fetch(`/api/content-pipeline?id=${content.id}`, { method: 'DELETE' });
    onUpdate();
    setActionInProgress('');
    onClose();
  };

  const [showReviseNotes, setShowReviseNotes] = useState(false);
  const [reviseNotes, setReviseNotes] = useState('');

  const handleSendBack = async () => {
    if (!showReviseNotes) {
      setShowReviseNotes(true);
      return;
    }
    setActionInProgress('revise');
    await updateContent({ stage: 'writing', notes: reviseNotes || 'Needs revision' });
    setActionInProgress('');
    onClose();
  };

  // Calculate textarea rows
  const lines = editedBody.split('\n');
  const estimatedRows = lines.reduce((sum, line) => sum + Math.max(1, Math.ceil((line.length || 1) / 60)), 0);
  const rows = Math.min(Math.max(estimatedRows, 4), 20);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-slate-900 border border-white/10 rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white flex-1 mr-4">{content.title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10">
            <X size={18} />
          </button>
        </div>

        {/* Platform selector (multi-select) */}
        <div className="mb-4">
          <label className="text-xs text-slate-500 mb-1.5 block">Post to platforms</label>
          <div className="flex gap-2">
            {platforms.map(p => (
              <button
                key={p.id}
                onClick={() => togglePlatform(p.id)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  selectedPlatforms.includes(p.id)
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
                    : 'bg-white/5 text-slate-400 border border-white/10 hover:text-white'
                }`}
              >
                {p.icon} {p.label}
                {selectedPlatforms.includes(p.id) && ' ✓'}
              </button>
            ))}
          </div>
          {selectedPlatforms.length > 1 && (
            <p className="text-xs text-amber-400/70 mt-1.5">
              Will post to {selectedPlatforms.length} platforms
            </p>
          )}
        </div>
        
        {/* Image */}
        <div className="mb-4">
          <ImageUploadField
            currentUrl={content.thumbnail_url}
            onUploaded={async (url) => {
              await updateContent({ thumbnail_url: url });
            }}
          />
        </div>

        {/* Editable caption */}
        <div className="mb-4">
          <label className="text-sm font-medium text-slate-400 mb-1 block">Caption</label>
          <textarea
            value={editedBody}
            onChange={e => setEditedBody(e.target.value)}
            rows={rows}
            className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm resize-y focus:outline-none focus:border-amber-500/50"
            placeholder="Write your caption..."
          />
          {selectedPlatforms.includes('x') && (
            <p className={`text-xs mt-1 ${editedBody.length > 280 ? 'text-red-400' : 'text-slate-500'}`}>
              {editedBody.length}/280 characters
            </p>
          )}
        </div>

        {/* Meta info */}
        <div className="flex items-center gap-4 mb-6 text-xs text-slate-500">
          <span>Stage: <span className="text-slate-300">{content.stage}</span></span>
          {content.agent_name && <span>By: <span className="text-slate-300">{content.agent_avatar} {content.agent_name}</span></span>}
          <span>{format(new Date(content.created_at), 'MMM d, yyyy')}</span>
        </div>

        {/* Revision notes */}
        {showReviseNotes && (
          <div className="mb-4 p-4 bg-yellow-600/10 border border-yellow-600/30 rounded-lg">
            <label className="text-sm font-medium text-yellow-400 mb-2 block">Revision Notes</label>
            <textarea
              value={reviseNotes}
              onChange={e => setReviseNotes(e.target.value)}
              rows={3}
              className="w-full bg-white/5 border border-white/10 rounded-lg p-3 text-white text-sm resize-y focus:outline-none focus:border-yellow-500/50"
              placeholder="What needs to change?"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <button
                onClick={handleSendBack}
                disabled={!!actionInProgress}
                className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
              >
                {actionInProgress === 'revise' ? 'Sending...' : 'Send Back for Revision'}
              </button>
              <button
                onClick={() => { setShowReviseNotes(false); setReviseNotes(''); }}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 rounded-lg text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="flex items-center gap-3 pt-4 border-t border-white/10">
          {content.stage === 'review' && (
            <>
              <button
                onClick={handleApprove}
                disabled={!!actionInProgress}
                className="flex-1 px-4 py-3 bg-green-600 hover:bg-green-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
              >
                {actionInProgress === 'approve' ? '...' : '✅ Approve → Schedule'}
              </button>
              <button
                onClick={handlePublish}
                disabled={!!actionInProgress}
                className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
              >
                {actionInProgress === 'publish' ? '...' : '🚀 Approve & Post Now'}
              </button>
              <button
                onClick={handleSendBack}
                disabled={!!actionInProgress}
                className="px-4 py-3 bg-yellow-600/20 hover:bg-yellow-600/30 text-yellow-400 font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
              >
                {actionInProgress === 'revise' ? '...' : '✏️ Revise'}
              </button>
              <button
                onClick={handleReject}
                disabled={!!actionInProgress}
                className="px-4 py-3 bg-red-600/20 hover:bg-red-600/30 text-red-400 font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
              >
                {actionInProgress === 'reject' ? '...' : '🗑️'}
              </button>
            </>
          )}
          {content.stage === 'scheduled' && (
            <button
              onClick={handlePublish}
              disabled={!!actionInProgress}
              className="flex-1 px-4 py-3 bg-amber-600 hover:bg-amber-500 text-white font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
            >
              {actionInProgress === 'publish' ? 'Posting...' : '🚀 Post Now'}
            </button>
          )}
          {content.stage !== 'review' && content.stage !== 'scheduled' && content.stage !== 'published' && (
            <button
              onClick={() => updateContent({ stage: 'review' })}
              className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-500 text-white font-medium rounded-lg transition-all text-sm"
            >
              Move to Review →
            </button>
          )}
          {isEdited && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-3 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg transition-all disabled:opacity-50 text-sm"
            >
              {saving ? 'Saving...' : '💾 Save Edits'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}