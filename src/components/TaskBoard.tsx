'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
import { arrayMove } from '@dnd-kit/sortable';
import { motion } from 'framer-motion';
import { Play, Square, Loader2, Search, Filter, BookTemplate } from 'lucide-react';
import { Task, TaskStatus, Agent, TASK_STATUS_CONFIG } from '@/types';
import TaskColumn from './TaskColumn';
import TaskCard from './TaskCard';
import TaskDetailModal from './TaskDetailModal';
import TaskExecutor from './TaskExecutor';

const columns: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

interface QueueStatus {
  status: 'idle' | 'running' | 'stopping';
  currentTaskId: string | null;
  tasksProcessed: number;
  tasksRemaining: number;
}

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    status: 'idle',
    currentTaskId: null,
    tasksProcessed: 0,
    tasksRemaining: 0,
  });
  const [queueMessage, setQueueMessage] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  // Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createWithStatus, setCreateWithStatus] = useState<TaskStatus | undefined>(undefined);
  const [executingTask, setExecutingTask] = useState<Task | null>(null);
  const modalOpen = selectedTask !== null || createWithStatus !== undefined;

  // Search & filter state
  const [searchQuery, setSearchQuery] = useState('');
  const [filterAgent, setFilterAgent] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [templates, setTemplates] = useState<Array<{ id: string; name: string; category: string; title: string; description: string; tags: string[]; priority: string; suggestedAgent: string }>>([]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const fetchTasks = useCallback(async () => {
    try {
      const res = await fetch('/api/tasks');
      if (res.ok) {
        const data = await res.json();
        setTasks(Array.isArray(data) ? data : data.tasks || []);
      }
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error('Failed to fetch agents:', err);
    }
  }, []);

  const fetchQueueStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/queue');
      if (res.ok) {
        const data = await res.json();
        setQueueStatus(data);
        if (data.status === 'running') {
          // Refresh tasks while queue is running
          fetchTasks();
        }
      }
    } catch { /* ignore */ }
  }, []);

  // Poll queue status while running
  useEffect(() => {
    if (queueStatus.status === 'running') {
      pollRef.current = setInterval(fetchQueueStatus, 3000);
    } else {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [queueStatus.status, fetchQueueStatus]);

  const fetchTemplates = useCallback(async () => {
    try {
      const res = await fetch('/api/templates');
      if (res.ok) setTemplates(await res.json());
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchTasks();
    fetchAgents();
    fetchQueueStatus();
    fetchTemplates();
  }, [fetchTasks, fetchAgents, fetchQueueStatus, fetchTemplates]);

  // Filtered tasks
  const filteredTasks = tasks.filter((t) => {
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchTitle = t.title.toLowerCase().includes(q);
      const matchDesc = (t.description || '').toLowerCase().includes(q);
      const matchTags = Array.isArray(t.tags) && t.tags.some(tag => tag.toLowerCase().includes(q));
      if (!matchTitle && !matchDesc && !matchTags) return false;
    }
    if (filterAgent && t.assigneeId !== filterAgent) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    return true;
  });

  const handleCreateFromTemplate = async (template: typeof templates[0]) => {
    const agent = agents.find(a => a.name === template.suggestedAgent);
    try {
      await fetch('/api/tasks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: template.title,
          description: template.description,
          status: 'todo',
          priority: template.priority,
          assigneeId: agent?.id || null,
          tags: template.tags,
        }),
      });
      fetchTasks();
      setShowTemplates(false);
    } catch (err) {
      console.error('Failed to create from template:', err);
    }
  };

  const handleQueueStart = async () => {
    setQueueMessage(null);
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      setQueueMessage(data.message);
      if (data.ok) {
        setQueueStatus((prev) => ({ ...prev, status: 'running' }));
        fetchQueueStatus();
      }
    } catch (err) {
      setQueueMessage('Failed to start queue');
    }
  };

  const handleQueueStop = async () => {
    try {
      const res = await fetch('/api/queue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stop' }),
      });
      const data = await res.json();
      setQueueMessage(data.message);
      setQueueStatus((prev) => ({ ...prev, status: 'stopping' }));
    } catch {
      setQueueMessage('Failed to stop queue');
    }
  };

  const handleTaskRun = (task: Task) => {
    setExecutingTask(task);
  };

  const handleAddTask = (status: TaskStatus) => {
    setCreateWithStatus(status);
  };

  const handleTaskClick = (task: Task) => {
    setSelectedTask(task);
  };

  const handleModalClose = () => {
    setSelectedTask(null);
    setCreateWithStatus(undefined);
  };

  const handleTaskSave = async (taskData: Partial<Task> & { id: string }) => {
    try {
      if (taskData.id === '__new__') {
        // Create new task
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: taskData.title,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            assigneeId: taskData.assigneeId,
            tags: taskData.tags || [],
            dependsOn: taskData.dependsOn || '',
          }),
        });
        if (res.ok) {
          fetchTasks();
        }
      } else {
        // Update existing task
        const res = await fetch(`/api/tasks/${taskData.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: taskData.title,
            description: taskData.description,
            status: taskData.status,
            priority: taskData.priority,
            assigneeId: taskData.assigneeId,
            tags: taskData.tags || [],
            dependsOn: taskData.dependsOn || '',
          }),
        });
        if (res.ok) {
          fetchTasks();
        }
      }
    } catch (err) {
      console.error('Failed to save task:', err);
    }
    handleModalClose();
  };

  const handleTaskDelete = async (taskId: string) => {
    try {
      const res = await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
      if (res.ok) {
        fetchTasks();
      }
    } catch (err) {
      console.error('Failed to delete task:', err);
    }
    handleModalClose();
  };

  const updateTaskStatus = async (taskId: string, status: TaskStatus) => {
    try {
      await fetch(`/api/tasks/${taskId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
    } catch (err) {
      console.error('Failed to update task:', err);
    }
  };

  function handleDragStart(event: DragStartEvent) {
    const task = tasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  }

  function handleDragOver(event: DragOverEvent) {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const draggedTask = tasks.find((t) => t.id === activeId);
    if (!draggedTask) return;

    // Dropped over a column directly
    if (columns.includes(overId as TaskStatus)) {
      if (draggedTask.status !== overId) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === activeId ? { ...t, status: overId as TaskStatus } : t
          )
        );
      }
      return;
    }

    // Dropped over another task
    const overTask = tasks.find((t) => t.id === overId);
    if (overTask && draggedTask.status !== overTask.status) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === activeId ? { ...t, status: overTask.status } : t
        )
      );
    }
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    const draggedTask = activeTask;
    setActiveTask(null);

    if (!over || !draggedTask) return;

    const activeId = active.id as string;
    const task = tasks.find((t) => t.id === activeId);
    if (task && task.status !== draggedTask.status) {
      updateTaskStatus(task.id, task.status);
    }

    // Reorder within same column
    const overId = over.id as string;
    if (activeId !== overId && !columns.includes(overId as TaskStatus)) {
      const overTask = tasks.find((t) => t.id === overId);
      if (overTask && task && task.status === overTask.status) {
        const columnTasks = tasks.filter((t) => t.status === task.status);
        const oldIndex = columnTasks.findIndex((t) => t.id === activeId);
        const newIndex = columnTasks.findIndex((t) => t.id === overId);
        if (oldIndex !== -1 && newIndex !== -1) {
          const reordered = arrayMove(columnTasks, oldIndex, newIndex);
          setTasks((prev) => {
            const otherTasks = prev.filter((t) => t.status !== task.status);
            return [...otherTasks, ...reordered];
          });
        }
      }
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-slate-500 text-sm">
        Loading tasks...
      </div>
    );
  }

  const isRunning = queueStatus.status === 'running';
  const isStopping = queueStatus.status === 'stopping';
  const currentTaskTitle = queueStatus.currentTaskId
    ? tasks.find((t) => t.id === queueStatus.currentTaskId)?.title ?? queueStatus.currentTaskId
    : null;

  return (
    <>
      {/* Search, filter, templates bar */}
      <div className="flex items-center gap-2 mb-2 px-1 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
          <input type="text" placeholder="Search tasks..." value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="glass-sm pl-8 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 w-full outline-none focus:border-emerald-500/30" />
        </div>
        <button onClick={() => setShowFilters(!showFilters)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${showFilters ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' : 'text-slate-400 border-white/10 hover:border-white/20'}`}>
          <Filter size={12} />Filters
        </button>
        <button onClick={() => setShowTemplates(!showTemplates)}
          className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${showTemplates ? 'text-cyan-400 border-cyan-500/30 bg-cyan-500/10' : 'text-slate-400 border-white/10 hover:border-white/20'}`}>
          <BookTemplate size={12} />Templates
        </button>
      </div>

      {/* Filter dropdowns */}
      {showFilters && (
        <div className="flex items-center gap-2 mb-2 px-1">
          <select value={filterAgent} onChange={(e) => setFilterAgent(e.target.value)}
            className="glass-sm px-2 py-1.5 text-xs text-slate-200 outline-none bg-transparent">
            <option value="" className="bg-slate-900">All Agents</option>
            {agents.map(a => <option key={a.id} value={a.id} className="bg-slate-900">{a.avatar} {a.name}</option>)}
          </select>
          <select value={filterPriority} onChange={(e) => setFilterPriority(e.target.value)}
            className="glass-sm px-2 py-1.5 text-xs text-slate-200 outline-none bg-transparent">
            <option value="" className="bg-slate-900">All Priorities</option>
            <option value="critical" className="bg-slate-900">🔴 Critical</option>
            <option value="high" className="bg-slate-900">🟠 High</option>
            <option value="medium" className="bg-slate-900">🟡 Medium</option>
            <option value="low" className="bg-slate-900">🔵 Low</option>
          </select>
          {(filterAgent || filterPriority) && (
            <button onClick={() => { setFilterAgent(''); setFilterPriority(''); }}
              className="text-xs text-slate-500 hover:text-slate-300">Clear</button>
          )}
        </div>
      )}

      {/* Templates panel */}
      {showTemplates && (
        <div className="mb-3 px-1 glass p-3 rounded-xl max-h-48 overflow-y-auto">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2">
            {templates.map(t => (
              <button key={t.id} onClick={() => handleCreateFromTemplate(t)}
                className="text-left p-2 rounded-lg hover:bg-white/5 border border-white/5 hover:border-white/15 transition-all">
                <p className="text-xs font-medium text-slate-200">{t.name}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{t.category}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Queue controls bar */}
      <div className="flex items-center gap-3 mb-3 px-1">
        {!isRunning && !isStopping ? (
          <button
            onClick={handleQueueStart}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-emerald-500/20 text-emerald-300 border border-emerald-500/30
              hover:bg-emerald-500/30 transition-all"
          >
            <Play size={12} />
            Run Queue
          </button>
        ) : (
          <button
            onClick={handleQueueStop}
            disabled={isStopping}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-red-500/20 text-red-300 border border-red-500/30
              hover:bg-red-500/30 disabled:opacity-50 transition-all"
          >
            <Square size={12} />
            {isStopping ? 'Stopping…' : 'Stop Queue'}
          </button>
        )}

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {isRunning && (
            <span className="flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 size={11} className="animate-spin" />
              {currentTaskTitle ? `Running: ${currentTaskTitle}` : 'Processing queue…'}
            </span>
          )}
          {(isRunning || queueStatus.tasksProcessed > 0) && (
            <span className="text-xs text-slate-500">
              {queueStatus.tasksProcessed} done · {queueStatus.tasksRemaining} remaining
            </span>
          )}
          {queueMessage && !isRunning && (
            <span className="text-xs text-slate-400">{queueMessage}</span>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.3 }}
        className="flex gap-4 overflow-x-auto pb-4 h-full"
      >
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          {columns.map((status) => (
            <TaskColumn
              key={status}
              status={status}
              title={TASK_STATUS_CONFIG[status].label}
              tasks={filteredTasks.filter((t) => t.status === status)}
              allTasks={tasks}
              onAddTask={handleAddTask}
              onTaskClick={handleTaskClick}
              onTaskRun={handleTaskRun}
            />
          ))}

          <DragOverlay>
            {activeTask ? <TaskCard task={activeTask} overlay /> : null}
          </DragOverlay>
        </DndContext>
      </motion.div>

      {executingTask && (
        <TaskExecutor
          task={executingTask}
          agents={agents}
          onClose={() => setExecutingTask(null)}
          onComplete={() => fetchTasks()}
        />
      )}

      {modalOpen && (
        <TaskDetailModal
          task={selectedTask}
          agents={agents}
          onClose={handleModalClose}
          onSave={handleTaskSave}
          onDelete={handleTaskDelete}
          createWithStatus={createWithStatus}
        />
      )}
    </>
  );
}
