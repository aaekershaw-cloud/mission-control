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
} from 'lucide-react';
import {
  Task,
  TaskStatus,
  TaskPriority,
  Agent,
  TASK_STATUS_CONFIG,
  PRIORITY_CONFIG,
} from '@/types';

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setDescription(task.description || '');
      setStatus(task.status);
      setPriority(task.priority);
      setAssigneeId(task.assigneeId || '');
      setTagsInput(task.tags.join(', '));
    } else if (createWithStatus) {
      setTitle('');
      setDescription('');
      setStatus(createWithStatus);
      setPriority('medium');
      setAssigneeId('');
      setTagsInput('');
    }
  }, [task, createWithStatus]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  function handleSave() {
    if (!title.trim()) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (isCreating) {
      // Create mode - onSave will handle the POST
      onSave({
        id: '__new__',
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeId || null,
        tags,
      });
    } else if (task) {
      onSave({
        id: task.id,
        title: title.trim(),
        description: description.trim(),
        status,
        priority,
        assigneeId: assigneeId || null,
        tags,
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
        className="fixed inset-0 modal-overlay z-50 flex items-center justify-center p-4"
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
          className="glass gradient-border w-full max-w-lg max-h-[85vh] overflow-y-auto"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-5 border-b border-white/5">
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
                rows={3}
                className="w-full mt-1 glass-sm px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none resize-none focus:border-emerald-500/30 transition-colors"
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
    </AnimatePresence>
  );
}
