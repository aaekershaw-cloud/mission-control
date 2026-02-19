'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Clock, Play, Link2, Lock } from 'lucide-react';
import { Task, PRIORITY_CONFIG } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface TaskCardProps {
  task: Task;
  overlay?: boolean;
  onClick?: (task: Task) => void;
  onRun?: (task: Task) => void;
  allTasks?: Task[];
}

const priorityDotColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
};

export default function TaskCard({ task, overlay = false, onClick, onRun, allTasks = [] }: TaskCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: { type: 'task', task },
    disabled: overlay,
  });

  const style = overlay
    ? {}
    : {
        transform: CSS.Transform.toString(transform),
        transition,
      };

  const timeAgo = task.createdAt
    ? formatDistanceToNow(new Date(task.createdAt), { addSuffix: true })
    : '';

  // Dependency status
  const depIds = (task.dependsOn || '').split(',').map((s) => s.trim()).filter(Boolean);
  const hasDeps = depIds.length > 0;
  const isBlocked = hasDeps && depIds.some((depId) => {
    const dep = allTasks.find((t) => t.id === depId);
    return !dep || (dep.status !== 'done' && dep.status !== 'review');
  });
  const isReady = hasDeps && !isBlocked;

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={style}
      className={`glass-sm p-3 cursor-grab active:cursor-grabbing group ${
        isDragging ? 'opacity-40' : ''
      } ${overlay ? 'shadow-2xl shadow-black/50 ring-1 ring-emerald-500/30' : ''}`}
    >
      <div className="flex items-start gap-2">
        {/* Drag handle */}
        <div
          {...(overlay ? {} : { ...attributes, ...listeners })}
          className="mt-0.5 text-slate-600 group-hover:text-slate-400 transition-colors"
        >
          <GripVertical size={14} />
        </div>

        <div
          className="flex-1 min-w-0 cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onClick?.(task);
          }}
        >
          {/* Priority & Title */}
          <div className="flex items-center gap-2 mb-1.5">
            <span
              className={`w-2 h-2 rounded-full shrink-0 ${
                priorityDotColors[task.priority]
              }`}
            />
            <p className="text-sm font-medium text-slate-200 truncate">
              {task.title}
            </p>
          </div>

          {/* Tags */}
          {(Array.isArray(task.tags) ? task.tags : []).length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {(Array.isArray(task.tags) ? task.tags : []).map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700/50 text-slate-400"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}

          {/* Dependency badge */}
          {hasDeps && (
            <div className="flex items-center gap-1 mb-1.5">
              {isBlocked ? (
                <span className="flex items-center gap-0.5 text-[10px] text-red-400/80 bg-red-500/10 rounded px-1.5 py-0.5">
                  <Lock size={8} />
                  Blocked
                </span>
              ) : (
                <span className="flex items-center gap-0.5 text-[10px] text-emerald-400/80 bg-emerald-500/10 rounded px-1.5 py-0.5">
                  <Link2 size={8} />
                  {isReady ? 'Ready' : 'Chained'}
                </span>
              )}
            </div>
          )}

          {/* Bottom row */}
          <div className="flex items-center justify-between">
            {/* Assignee */}
            {task.assigneeName ? (
              <div className="flex items-center gap-1.5">
                <span className="text-xs">{task.assigneeAvatar || '?'}</span>
                <span className="text-xs text-slate-500 truncate max-w-[80px]">
                  {task.assigneeName}
                </span>
              </div>
            ) : (
              <span className="text-xs text-slate-600 italic">Unassigned</span>
            )}

            {/* Time + Run */}
            <div className="flex items-center gap-2">
              {task.assigneeId && task.status !== 'done' && onRun && (
                <button
                  onClick={(e) => { e.stopPropagation(); onRun(task); }}
                  className="text-emerald-500/60 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100"
                  title="Run agent"
                >
                  <Play size={12} />
                </button>
              )}
              <div className="flex items-center gap-1 text-slate-600">
                <Clock size={10} />
                <span className="text-[10px]">{timeAgo}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
