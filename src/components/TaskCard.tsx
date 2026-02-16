'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { GripVertical, Clock } from 'lucide-react';
import { Task, PRIORITY_CONFIG } from '@/types';
import { formatDistanceToNow } from 'date-fns';

interface TaskCardProps {
  task: Task;
  overlay?: boolean;
  onClick?: (task: Task) => void;
}

const priorityDotColors: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-500',
  medium: 'bg-yellow-500',
  low: 'bg-blue-400',
};

export default function TaskCard({ task, overlay = false, onClick }: TaskCardProps) {
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
          {task.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mb-2">
              {task.tags.map((tag) => (
                <span
                  key={tag}
                  className="text-[10px] px-1.5 py-0.5 rounded-md bg-slate-700/50 text-slate-400"
                >
                  {tag}
                </span>
              ))}
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

            {/* Time */}
            <div className="flex items-center gap-1 text-slate-600">
              <Clock size={10} />
              <span className="text-[10px]">{timeAgo}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
