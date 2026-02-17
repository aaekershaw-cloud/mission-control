'use client';

import { useState, useEffect, useCallback } from 'react';
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
import { Task, TaskStatus, Agent, TASK_STATUS_CONFIG } from '@/types';
import TaskColumn from './TaskColumn';
import TaskCard from './TaskCard';
import TaskDetailModal from './TaskDetailModal';
import TaskExecutor from './TaskExecutor';

const columns: TaskStatus[] = ['backlog', 'todo', 'in_progress', 'review', 'done'];

export default function TaskBoard() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [createWithStatus, setCreateWithStatus] = useState<TaskStatus | undefined>(undefined);
  const [executingTask, setExecutingTask] = useState<Task | null>(null);
  const modalOpen = selectedTask !== null || createWithStatus !== undefined;

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

  useEffect(() => {
    fetchTasks();
    fetchAgents();
  }, [fetchTasks, fetchAgents]);

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
    setActiveTask(null);

    if (!over) return;

    const activeId = active.id as string;
    const task = tasks.find((t) => t.id === activeId);
    if (task) {
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

  return (
    <>
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
              tasks={tasks.filter((t) => t.status === status)}
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
