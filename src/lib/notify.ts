import { appendFileSync } from 'fs';
import path from 'path';

const REVIEWS_FILE = path.join(
  process.env.HOME || '/Users/andrewkershaw',
  '.openclaw/workspace/mission-control-reviews.jsonl'
);

export function notifyReviewReady(params: {
  taskId: string;
  taskTitle: string;
  agentName: string;
  agentAvatar: string;
  response: string;
}) {
  const line = JSON.stringify({
    taskId: params.taskId,
    taskTitle: params.taskTitle,
    agentName: params.agentName,
    agentAvatar: params.agentAvatar,
    summary: params.response.slice(0, 200),
    timestamp: new Date().toISOString(),
  });

  try {
    appendFileSync(REVIEWS_FILE, line + '\n');
  } catch (err) {
    console.error('Failed to write review notification:', err);
  }
}
