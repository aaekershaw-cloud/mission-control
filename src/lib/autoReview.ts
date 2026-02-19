import { getDb } from '@/lib/db';
import { getTool } from '@/lib/tools';

export interface AutoReviewResult {
  decision: 'approve' | 'reject' | 'flag';
  reasons: string[];       // why this decision was made
  checks: {               // detailed check results
    name: string;
    passed: boolean;
    detail?: string;
  }[];
  repairedContent?: string; // if JSON was repaired, include the fixed version
}

export async function autoReviewTask(taskId: string): Promise<AutoReviewResult> {
  const db = getDb();
  
  // Load task + latest task_result from DB
  const task = db.prepare(`
    SELECT t.*, a.name as agent_name, a.codename as agent_codename
    FROM tasks t
    LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.id = ?
  `).get(taskId) as Record<string, string> | undefined;

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  const taskResult = db.prepare(`
    SELECT response FROM task_results 
    WHERE task_id = ? AND status = 'completed' 
    ORDER BY created_at DESC LIMIT 1
  `).get(taskId) as { response: string } | undefined;

  if (!taskResult) {
    throw new Error(`No completed result found for task ${taskId}`);
  }

  const response = taskResult.response;
  const reasons: string[] = [];
  const checks: { name: string; passed: boolean; detail?: string; }[] = [];
  
  // Parse task tags
  const tags = (() => {
    try {
      return JSON.parse(task.tags || '[]') as string[];
    } catch {
      return [];
    }
  })();

  // **INSTANT REJECT CHECKS**
  
  // 1. Empty or near-empty response (< 20 chars)
  const emptyCheck = response.trim().length >= 20;
  checks.push({
    name: 'Minimum Length',
    passed: emptyCheck,
    detail: emptyCheck ? `${response.length} chars` : `Only ${response.length} chars, minimum is 20`
  });
  
  if (!emptyCheck) {
    reasons.push('Response too short (< 20 chars)');
    return { decision: 'reject', reasons, checks };
  }

  // 2. Response is just the system prompt echoed back
  const promptEchoCheck = !response.includes('OUTPUT FORMAT RULES') && !response.includes('MANDATORY');
  checks.push({
    name: 'Not Prompt Echo',
    passed: promptEchoCheck,
    detail: promptEchoCheck ? 'Response is original content' : 'Response appears to echo system prompt'
  });

  if (!promptEchoCheck) {
    reasons.push('Response echoes system prompt');
    return { decision: 'reject', reasons, checks };
  }

  // 3. JSON malformed AND can't be repaired
  let isJsonResponse = false;
  let jsonValid = true;
  let repairedContent: string | undefined;
  
  // Check if response should be JSON
  if (response.trim().startsWith('```') || response.trim().startsWith('[') || response.trim().startsWith('{')) {
    isJsonResponse = true;
    
    // Extract JSON from code blocks
    let jsonContent = response;
    const jsonMatch = response.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1].trim();
    }
    
    // Try to parse
    try {
      JSON.parse(jsonContent);
      jsonValid = true;
    } catch {
      jsonValid = false;
      
      // Try basic repair: trim to last } or ]
      let repaired = jsonContent;
      const lastBrace = repaired.lastIndexOf('}');
      const lastBracket = repaired.lastIndexOf(']');
      const lastValidChar = Math.max(lastBrace, lastBracket);
      
      if (lastValidChar > 0) {
        repaired = repaired.substring(0, lastValidChar + 1);
        try {
          JSON.parse(repaired);
          jsonValid = true;
          repairedContent = repaired;
        } catch {
          // Still invalid after repair
        }
      }
    }
  }

  if (isJsonResponse) {
    checks.push({
      name: 'Valid JSON',
      passed: jsonValid,
      detail: jsonValid ? (repairedContent ? 'Valid after repair' : 'Valid as-is') : 'Invalid and unrepairable JSON'
    });

    if (!jsonValid) {
      reasons.push('Malformed JSON that cannot be repaired');
      return { decision: 'reject', reasons, checks, repairedContent };
    }
  }

  // **CONTENT QUALITY CHECKS**

  // 4. Tab validation (if task includes 'tab' or 'lick')
  if (tags.some(tag => ['tab', 'lick'].includes(tag.toLowerCase()))) {
    let tabValid = true;
    let tabErrors: string[] = [];
    
    // Extract tab content from response (look for tablature patterns)
    const tabMatches = response.match(/[eEbBgGdDaA]\|[\d\-hpb\/\\~x\|\s]+/g);
    
    if (tabMatches) {
      const validateTab = getTool('validate_tab');
      if (validateTab) {
        try {
          const tabContent = tabMatches.join('\n');
          const validation = await validateTab.execute({ tab: tabContent }) as { valid: boolean; errors: string[]; warnings: string[] };
          tabValid = validation.valid;
          tabErrors = validation.errors;
        } catch (error: any) {
          tabValid = false;
          tabErrors = [`Validation failed: ${error.message}`];
        }
      }
    } else {
      tabValid = false;
      tabErrors = ['No valid tab notation found in response'];
    }

    checks.push({
      name: 'Tab Validation',
      passed: tabValid,
      detail: tabValid ? 'Tab notation is valid' : tabErrors.join('; ')
    });

    if (!tabValid) {
      reasons.push(`Tab validation failed: ${tabErrors.join(', ')}`);
      return { decision: 'flag', reasons, checks, repairedContent };
    }
  }

  // **ALWAYS FLAG CATEGORIES**
  
  // 5. Social, email, caption content
  const publicFacingTags = ['social', 'email', 'caption'];
  const isPublicFacing = tags.some(tag => publicFacingTags.includes(tag.toLowerCase()));
  
  if (isPublicFacing) {
    checks.push({
      name: 'Public Content Check',
      passed: false,
      detail: 'Public-facing content requires human review'
    });
    reasons.push('Public-facing content (social/email/caption)');
    return { decision: 'flag', reasons, checks, repairedContent };
  }

  // 6. Review-required or external tags
  const alwaysReviewTags = ['review-required', 'external'];
  const requiresReview = tags.some(tag => alwaysReviewTags.includes(tag.toLowerCase()));
  
  if (requiresReview) {
    checks.push({
      name: 'Requires Review Tag',
      passed: false,
      detail: 'Tagged for mandatory human review'
    });
    reasons.push('Tagged as requiring human review');
    return { decision: 'flag', reasons, checks, repairedContent };
  }

  // **MINIMUM CONTENT LENGTH CHECKS**
  
  // Determine minimum length based on task type
  let minLength = 50; // default
  const taskTitle = task.title.toLowerCase();
  
  if (tags.some(tag => ['lick', 'tab'].includes(tag.toLowerCase())) || taskTitle.includes('lick') || taskTitle.includes('tab')) {
    minLength = 100;
  } else if (tags.some(tag => tag.toLowerCase() === 'lesson') || taskTitle.includes('lesson')) {
    minLength = 300;
  } else if (taskTitle.includes('blog') || taskTitle.includes('post')) {
    minLength = 500;
  } else if (tags.some(tag => ['social', 'caption'].includes(tag.toLowerCase()))) {
    minLength = 50;
  }

  const lengthCheck = response.length >= minLength;
  checks.push({
    name: 'Content Length',
    passed: lengthCheck,
    detail: lengthCheck ? `${response.length} chars (min: ${minLength})` : `Only ${response.length} chars, minimum is ${minLength}`
  });

  if (!lengthCheck) {
    reasons.push(`Content seems too short (${response.length} chars, expected at least ${minLength})`);
    return { decision: 'flag', reasons, checks, repairedContent };
  }

  // **AUTO-APPROVE CONDITIONS**
  
  // All checks passed!
  reasons.push('All automated checks passed');
  return { decision: 'approve', reasons, checks, repairedContent };
}