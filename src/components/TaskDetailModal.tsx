'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Save,
  Trash2,
  AlertTriangle,
  Clock,
  Tag,
  User,
  FileText,
  CheckCircle,
  RotateCcw,
  XCircle,
  Eye,
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  Agent,
  TASK_STATUS_CONFIG,
  PRIORITY_CONFIG,
} from '@/types';
import { Link2, ChevronDown, ChevronRight } from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  agents: Agent[];
  onClose: () => void;
  onSave: (task: Partial<Task> & { id: string }) => void;
  onDelete: (taskId: string) => void;
  /** When set, the modal opens in create mode with this status pre-selected */
  createWithStatus?: TaskStatus;
}

const statusOptions: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];
const priorityOptions: TaskPriority[] = ['critical', 'high', 'medium', 'low'];

export default function TaskDetailModal({
  task,
  agents,
  onClose,
  onSave,
  onDelete,
  createWithStatus,
}: TaskDetailModalProps) {
  const isCreating = !task && createWithStatus !== undefined;

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [status, setStatus] = useState<TaskStatus>('backlog');
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [assigneeId, setAssigneeId] = useState<string>('');
  const [tagsInput, setTagsInput] = useState('');
  const [dependsOnInput, setDependsOnInput] = useState('');
  const [chainContextOpen, setChainContextOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reviewResult, setReviewResult] = useState<{ response: string; agent_name: string; agent_avatar: string; duration_ms: number; tokens_used: number } | null>(null);
  const [reviewFeedback, setReviewFeedback] = useState('');
  const [reviewAction, setReviewAction] = useState<'reject' | 'revise' | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId || '');
      setTagsInput((Array.isArray(task.tags) ? task.tags : []).join(', '));
      setDependsOnInput(task.dependsOn || '');
    } else if (createWithStatus) {
      setTitle('');
      setDescription('');
      setStatus(createWithStatus);
      setPriority('medium');
      setAssigneeId('');
      setTagsInput('');
      setDependsOnInput('');
    }
  }, [task, createWithStatus]);

  // Fetch review result when task is in review status
  useEffect(() => {
    if (task?.status === 'review') {
      fetch(`/api/tasks/${task.id}/review`)
        .then((r) => r.json())
        .then((data) => {
          if (data.result) setReviewResult(data.result);
        })
        .catch(console.error);
    } else {
      setReviewResult(null);
    }
    setReviewAction(null);
    setReviewFeedback('');
  }, [task?.id, task?.status]);

  async function handleReviewAction(action: 'approve' | 'reject' | 'revise') {
    if (!task) return;
    if ((action === 'reject' || action === 'revise') && !reviewFeedback.trim()) {
      setReviewAction(action);
      return;
    }
    setReviewLoading(true);
    try {
      const res = await fetch(`/api/tasks/${task.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, feedback: reviewFeedback.trim() || undefined }),
      });
      if (res.ok) {
        // Trigger board data refresh (onSave calls fetchTasks + closes modal)
        // Server auto-starts queue for reject/revise
        onSave({ id: task.id, status: action === 'approve' ? 'done' as TaskStatus : action === 'reject' ? 'todo' as TaskStatus : 'done' as TaskStatus });
      }
    } catch (err) {
      console.error('Review action failed:', err);
    } finally {
      setReviewLoading(false);
    }
  }

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (previewOpen) setPreviewOpen(false);
        else onClose();
      }
    };
    const handleMessage = (e: MessageEvent) => {
      if (e.data?.type === 'preview-action' && task) {
        setPreviewOpen(false);
        const newStatus = e.data.action === 'approve' ? 'done' : 'todo';
        onSave({ id: task.id, status: newStatus as TaskStatus });
      }
    };
    window.addEventListener('keydown', handleKey);
    window.addEventListener('message', handleMessage);
    return () => {
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('message', handleMessage);
    };
  }, [onClose, previewOpen, task, onSave]);

  function handleSave() {
    if (!title.trim()) return;

    // If in review mode with feedback, submit the revision via review API
    if (task?.status === 'review' && reviewAction && reviewFeedback.trim()) {
      handleReviewAction(reviewAction);
      return;
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    // When saving a review item, move it back to todo so the queue picks it up
    const effectiveStatus = task?.status === 'review' && status === 'review' ? 'todo' as TaskStatus : status;

    if (isCreating) {
      // Create mode - onSave will handle the POST
      onSave({
        id: '__new__',
        title: title.trim(),
        description: description.trim(),
        status: effectiveStatus,
        priority,
        assigneeId: assigneeId || null,
        tags,
        dependsOn: dependsOnInput.trim(),
      });
    } else if (task) {
      onSave({
        id: task.id,
        title: title.trim(),
        description: description.trim(),
        status: effectiveStatus,
        priority,
        assigneeId: assigneeId || null,
        tags,
        dependsOn: dependsOnInput.trim(),
      });
    }
  }

  function handleDelete() {
    if (!task) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    onDelete(task.id);
  }

  const timeAgo = task?.createdAt
    ? new Date(task.createdAt).toLocaleString()
    : null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 modal-overlay z-[60] flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="glass gradient-border w-full max-w-2xl max-h-[90dvh] overflow-y-auto pb-6"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5 sticky top-0 z-10 bg-[#0d1117]/95 backdrop-blur-sm">
            <h2 className="text-lg font-bold text-slate-100">
              {isCreating ? 'Create Task' : 'Task Details'}
            </h2>
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <FileText size={12} />
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Task title..."
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
                autoFocus
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
                placeholder="Task description..."
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-emerald-500/30 transition-colors overflow-hidden hover:overflow-y-auto focus:overflow-y-auto"
                style={{ height: task?.status === 'review' ? '12rem' : '5rem' }}
              />
            </div>

            {/* Status & Priority row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Status
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as TaskStatus)}
                  className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none bg-transparent focus:border-emerald-500/30 transition-colors"
                >
                  {statusOptions.map((s) => (
                    <option key={s} value={s} className="bg-slate-900">
                      {TASK_STATUS_CONFIG[s].label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-500 uppercase tracking-wider font-medium">
                  Priority
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as TaskPriority)}
                  className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none bg-transparent focus:border-emerald-500/30 transition-colors"
                >
                  {priorityOptions.map((p) => (
                    <option key={p} value={p} className="bg-slate-900">
                      {PRIORITY_CONFIG[p].icon} {PRIORITY_CONFIG[p].label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Assignee */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <User size={12} />
                Assigned Agent
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 outline-none bg-transparent focus:border-emerald-500/30 transition-colors"
              >
                <option value="" className="bg-slate-900">
                  Unassigned
                </option>
                {agents.map((a) => (
                  <option key={a.id} value={a.id} className="bg-slate-900">
                    {a.avatar} {a.name} ({a.codename})
                  </option>
                ))}
              </select>
            </div>

            {/* Tags */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <Tag size={12} />
                Tags
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="Comma-separated tags..."
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
              />
            </div>

            {/* Depends On */}
            <div>
              <label className="text-xs text-slate-500 uppercase tracking-wider font-medium flex items-center gap-1.5">
                <Link2 size={12} />
                Depends On
              </label>
              <input
                type="text"
                value={dependsOnInput}
                onChange={(e) => setDependsOnInput(e.target.value)}
                placeholder="Comma-separated task IDs..."
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-emerald-500/30 transition-colors"
              />
              <p className="text-[10px] text-slate-600 mt-0.5">
                Enter task IDs separated by commas. Dependent tasks auto-unlock when parents complete.
              </p>
            </div>

            {/* Review Section */}
            {task?.status === 'review' && reviewResult && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs text-amber-400 uppercase tracking-wider font-medium flex items-center gap-1.5">
                    📋 Agent Output — Ready for Review
                  </label>
                  <button
                    onClick={() => setPreviewOpen(true)}
                    className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                  >
                    <Eye size={12} />
                    Full Preview
                  </button>
                </div>
                <div className="glass-sm p-4 text-sm text-slate-300 whitespace-pre-wrap max-h-80 overflow-y-auto leading-relaxed hover:overflow-y-scroll cursor-text select-text">
                  {reviewResult.response}
                </div>
                <div className="text-[10px] text-slate-500">
                  {reviewResult.agent_avatar} {reviewResult.agent_name} · {reviewResult.tokens_used} tokens · {(reviewResult.duration_ms / 1000).toFixed(1)}s
                </div>

                {/* Feedback input for reject/revise */}
                {reviewAction && (
                  <div>
                    <textarea
                      value={reviewFeedback}
                      onChange={(e) => setReviewFeedback(e.target.value)}
                      placeholder={reviewAction === 'reject' ? 'What needs to change? Agent will re-run with this feedback...' : 'What should be revised? A new task will be created...'}
                      rows={3}
                      className="w-full glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-amber-500/30 transition-colors"
                      autoFocus
                    />
                  </div>
                )}

                {/* Review action buttons */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleReviewAction('approve')}
                    disabled={reviewLoading}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 transition-all disabled:opacity-50"
                  >
                    <CheckCircle size={14} />
                    Approve
                  </button>
                  <button
                    onClick={() => reviewAction === 'revise' && reviewFeedback.trim() ? handleReviewAction('revise') : setReviewAction('revise')}
                    disabled={reviewLoading}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                      reviewAction === 'revise'
                        ? 'text-blue-300 bg-blue-500/25 border border-blue-500/50'
                        : 'text-blue-300 bg-blue-500/15 border border-blue-500/30 hover:bg-blue-500/25'
                    }`}
                  >
                    <RotateCcw size={14} />
                    Revise
                  </button>
                  <button
                    onClick={() => reviewAction === 'reject' && reviewFeedback.trim() ? handleReviewAction('reject') : setReviewAction('reject')}
                    disabled={reviewLoading}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all disabled:opacity-50 ${
                      reviewAction === 'reject'
                        ? 'text-red-300 bg-red-500/25 border border-red-500/50'
                        : 'text-red-300 bg-red-500/15 border border-red-500/30 hover:bg-red-500/25'
                    }`}
                  >
                    <XCircle size={14} />
                    Reject
                  </button>
                </div>
              </div>
            )}

            {/* Chain Context (collapsible, view mode only) */}
            {task?.chainContext && (
              <div>
                <button
                  onClick={() => setChainContextOpen((o) => !o)}
                  className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 transition-colors"
                >
                  {chainContextOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                  Chain Context
                </button>
                {chainContextOpen && (
                  <div className="mt-2 glass-sm p-3 text-xs text-slate-400 whitespace-pre-wrap max-h-40 overflow-y-auto">
                    {task.chainContext}
                  </div>
                )}
              </div>
            )}

            {/* Created time (view mode only) */}
            {timeAgo && (
              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                <Clock size={12} />
                Created: {timeAgo}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between p-5 border-t border-white/5">
            {/* Delete button (only in edit mode) */}
            {task ? (
              <button
                onClick={handleDelete}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  confirmDelete
                    ? 'text-red-300 bg-red-500/20 border border-red-500/40'
                    : 'text-red-400 hover:bg-red-500/10 border border-red-500/30'
                }`}
              >
                {confirmDelete ? (
                  <>
                    <AlertTriangle size={14} />
                    Confirm Delete
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    Delete
                  </>
                )}
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <button
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={!title.trim()}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-slate-900 bg-gradient-to-r from-emerald-400 to-cyan-400 hover:from-emerald-300 hover:to-cyan-300 disabled:opacity-30 disabled:cursor-not-allowed transition-all shadow-lg shadow-emerald-500/20"
              >
                <Save size={14} />
                {isCreating ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </motion.div>
      </motion.div>
      {/* Preview Overlay */}
      {previewOpen && task && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setPreviewOpen(false); }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-[95vw] h-[92vh] rounded-2xl overflow-hidden bg-[#0a0a0f] border border-white/10 shadow-2xl flex flex-col"
          >
            <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-[#0d1117]/95 shrink-0">
              <span className="text-sm font-medium text-slate-300">Content Preview</span>
              <button
                onClick={() => setPreviewOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-white/5 transition-all"
              >
                <X size={16} />
              </button>
            </div>
            <iframe
              src={`/preview/${task.id}`}
              className="flex-1 w-full border-none"
              title="Content Preview"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
