import { getDb } from '@/lib/db';

// Keyword → agent codename mapping
const KEYWORD_TO_CODENAME: Array<{ keywords: string[]; codename: string }> = [
  { keywords: ['lick', 'tab', 'guitar'], codename: 'TabSmith' },
  { keywords: ['course', 'curriculum', 'lesson'], codename: 'LessonArchitect' },
  { keywords: ['backing', 'track', 'audio', 'music'], codename: 'TrackMaster' },
  { keywords: ['theory'], codename: 'TheoryBot' },
  { keywords: ['practice', 'coach', 'plan'], codename: 'CoachAI' },
  { keywords: ['progress', 'analytics', 'churn'], codename: 'FeedbackLoop' },
  { keywords: ['blog', 'content', 'newsletter', 'email'], codename: 'ContentMill' },
  { keywords: ['seo', 'keyword'], codename: 'SEOHawk' },
  { keywords: ['community', 'social', 'discord'], codename: 'CommunityPulse' },
  { keywords: ['revenue', 'kpi', 'financial', 'metric'], codename: 'BizOps' },
];

function findCodename(text: string): string | null {
  const lower = text.toLowerCase();
  for (const { keywords, codename } of KEYWORD_TO_CODENAME) {
    if (keywords.some((kw) => lower.includes(kw))) {
      return codename;
    }
  }
  return null;
}

/**
 * Given a task's tags array and description string, returns the agent ID
 * that best matches based on keyword mapping.
 * Returns null if no match found.
 */
export async function autoAssignTask(
  taskId: string,
  tags: string[],
  description: string
): Promise<string | null> {
  const tagText = tags.join(' ');

  // Try tags first
  let codename = findCodename(tagText);

  // Fall back to description keywords
  if (!codename) {
    codename = findCodename(description);
  }

  if (!codename) return null;

  const db = getDb();
  const agent = db.prepare('SELECT id FROM agents WHERE codename = ? LIMIT 1').get(codename) as
    | { id: string }
    | undefined;

  if (!agent) return null;

  // Update the task with the new assignee
  db.prepare("UPDATE tasks SET assignee_id = ?, updated_at = datetime('now') WHERE id = ?").run(
    agent.id,
    taskId
  );

  return agent.id;
}
