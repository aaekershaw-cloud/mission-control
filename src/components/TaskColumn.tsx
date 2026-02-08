'use client';

import { useDroppable } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Plus } from 'lucide-react';
import { Task, TaskStatus, TASK_STATUS_CONFIG } from '@/types';
import TaskCard from './TaskCard';

interface TaskColumnProps {
  status: TaskStatus;
  tasks: Task[];
  title: string;
}

const headerAccent: Record<TaskStatus, string> = {
  backlog: 'border-t-slate-500',
  todo: 'border-t-blue-500',
  in_progress: 'border-t-amber-500',
  review: 'border-t-purple-500',
  done: 'border-t-emerald-500',
};

export default function TaskColumn({ status, tasks, title }: TaskColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  const config = TASK_STATUS_CONFIG[status];

  return (
    <div
      className={`flex flex-col w-72 shrink-0 glass rounded-2xl border-t-2 ${
        headerAccent[status]
      } ${isOver ? 'drop-target-active' : ''} drop-target`}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <h3 className={`text-sm font-semibold ${config.color}`}>{title}</h3>
          <span
            className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${config.bgColor} ${config.color}`}
          >
            {tasks.length}
          </span>
        </div>
      </div>

      {/* Task list */}
      <div
        ref={setNodeRef}
        className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]"
      >
        <SortableContext
          items={tasks.map((t) => t.id)}
          strategy={verticalListSortingStrategy}
        >
          {tasks.map((task) => (
            <TaskCard key={task.id} task={task} />
          ))}
        </SortableContext>

        {tasks.length === 0 && (
          <div className="flex items-center justify-center h-20 text-xs text-slate-600">
            No tasks
          </div>
        )}
      </div>

      {/* Add button */}
      <button className="flex items-center justify-center gap-1.5 px-4 py-2.5 text-xs text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors border-t border-white/5 rounded-b-2xl">
        <Plus size={14} />
        Add Task
      </button>
    </div>
  );
}
