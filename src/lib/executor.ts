import { getDb } from '@/lib/db';
import { v4 as uuid } from 'uuid';
import { notifyReviewReady } from '@/lib/notify';
import { getToolsForAgent, executeTool } from '@/lib/agentTools';
import { processAutoReview } from '@/lib/autoApprove';
import { logActivity } from '@/lib/activityLog';

export interface ExecutionResult {
  id: string;
  taskId: string;
  agentId: string;
  agentName: string;
  agentAvatar: string;
  prompt: string;
  response: string;
  tokensUsed: number;
  costUsd: number;
  durationMs: number;
  status: 'completed' | 'error';
  error?: string;
}

export interface ProviderOverride {
  type: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  maxTokens?: number;
}

export async function executeTask(
  taskId: string,
  providerOverride?: ProviderOverride
): Promise<ExecutionResult> {
  const db = getDb();

  // Load task with agent info
  const task = await db.get(`
    SELECT t.*, a.id as agent_id, a.name as agent_name, a.avatar as agent_avatar,
           a.role as agent_role, a.personality as agent_personality, a.soul as agent_soul,
           a.provider as agent_provider, a.codename as agent_codename
    FROM tasks t
    LEFT JOIN agents a ON t.assignee_id = a.id
    WHERE t.id = $1
  `, [taskId]) as Record<string, string> | undefined;

  if (!task) {
    throw new Error(`Task ${taskId} not found`);
  }

  if (!task.agent_id) {
    throw new Error(`No agent assigned to task ${taskId}`);
  }

  const agentId = task.agent_id;

  // Load provider config — use override if provided (from client), else look up by agent's provider field
  let resolvedProvider: { type: string; base_url: string; api_key: string; model: string; max_tokens: number } | null = null;

  if (providerOverride) {
    resolvedProvider = {
      type: providerOverride.type,
      base_url: providerOverride.baseUrl,
      api_key: providerOverride.apiKey,
      model: providerOverride.model,
      max_tokens: providerOverride.maxTokens ?? 8192,
    };
  } else {
    const dbProvider = (await db.get(
      `SELECT * FROM provider_configs WHERE type = $1 AND api_key != '' LIMIT 1`,
      [task.agent_provider]
    ) as Record<string, string | number> | undefined)
      ?? (await db.get(
        `SELECT * FROM provider_configs WHERE is_default = true AND api_key != '' LIMIT 1`
      ) as Record<string, string | number> | undefined)
      ?? (await db.get(
        `SELECT * FROM provider_configs WHERE api_key != '' LIMIT 1`
      ) as Record<string, string | number> | undefined);

    if (!dbProvider) {
      throw new Error('No provider configured with an API key. Add one via Settings → Providers.');
    }

    resolvedProvider = {
      type: dbProvider.type as string,
      base_url: dbProvider.base_url as string,
      api_key: dbProvider.api_key as string,
      model: dbProvider.model as string,
      max_tokens: (dbProvider.max_tokens as number) ?? 8192,
    };
  }

  // Update statuses to in_progress
  await db.run("UPDATE tasks SET status = 'in_progress', updated_at = NOW() WHERE id = $1", [taskId]);
  await db.run("UPDATE agents SET status = 'busy', current_task_id = $1, updated_at = NOW() WHERE id = $2", [taskId, agentId]);

  // Log task start activity
  await logActivity('agent_task', `Task started: ${task.title}`, `Agent ${task.agent_name} began working`, agentId, { 
    taskId, 
    status: 'started' 
  });

  // Build system prompt from agent soul/personality/role
  const outputFormatGuide = `
## OUTPUT FORMAT RULES (MANDATORY)

Your output will be rendered in a content preview system. Follow these rules strictly:

### For Licks, Exercises, Tab Content:
Return a JSON array. Each item MUST include these fields:
- "lick_name": string
- "scale": string (e.g. "E Minor Pentatonic")
- "key": string (e.g. "E Minor")
- "difficulty": "Beginner" | "Intermediate" | "Advanced"
- "techniques": string[] (e.g. ["hammer-on", "pull-off", "bend"])
- "tab_notation": string — standard 6-line guitar tab using e|, B|, G|, D|, A|, E| format. Use h for hammer-on, p for pull-off, b for bend, s or / for slide, ~ for vibrato.
- "description": string
- "practice_tips": string
- "tempo": number (BPM, optional)
- "fret_range": string (e.g. "5-8", optional)

### For Courses, Lesson Sequences, Curricula:
Return a JSON object with:
- "courseTitle": string
- "courseDescription": string
- "lessons": array of lesson objects, each with:
  - "lessonNumber": number
  - "lessonTitle": string
  - "learningObjectives": string[]
  - "bloomsLevel": string (optional)
  - "activities": array of activity objects, each with:
    - "activityType": string (e.g. "Concept Introduction", "Demonstration", "Guided Practice", "Assessment")
    - "title": string
    - "content": string (for explanations)
    - "tasks": string[] (for practice items)
    - "successCriteria": string (optional)
    - "questions": string[] (for assessments, optional)

### For Practice Routines/Templates:
Return a JSON object or HTML. If HTML, use complete valid HTML with inline CSS (dark theme: #0a0a0f background, #f59e0b amber accent, white text).

### For Blog Posts, Social Captions, Emails, Strategies:
Use well-structured Markdown with headers (##), bold, bullet lists, and clear sections. Separate multiple items (e.g. caption options) with --- on its own line.

### For Instagram/Social Captions specifically:
Structure each caption as a separate section divided by ---. Include hashtags at the end of each caption.

### CRITICAL:
- Always wrap JSON output in \`\`\`json code fences
- Always wrap HTML output in \`\`\`html code fences
- Ensure JSON is valid — properly escape special characters in strings (use \\\\n for newlines in tab notation, not literal newlines inside JSON strings... actually, literal \\n in JSON strings is fine)
- Do NOT truncate output. Complete every JSON array and close all braces/brackets.
- Do NOT include conversational text before or after the JSON/HTML code fence — output ONLY the content.
`;

  const systemPrompt = [
    task.agent_soul || '',
    task.agent_personality ? `\nPersonality: ${task.agent_personality}` : '',
    task.agent_role ? `\nRole: ${task.agent_role}` : '',
    outputFormatGuide,
  ].filter(Boolean).join('\n');

  // Build user prompt — include chain context from parent tasks if present
  let userPrompt: string;

  const dependsOn = (task.depends_on as string) || '';
  const chainContext = (task.chain_context as string) || '';

  if (dependsOn && dependsOn.trim()) {
    // Load parent task results
    const parentIds = dependsOn.split(',').map((s: string) => s.trim()).filter(Boolean);
    const contextParts: string[] = [];

    for (const parentId of parentIds) {
      const parentTask = await db.get('SELECT id, title FROM tasks WHERE id = $1', [parentId]) as Record<string, string> | undefined;
      const parentResult = await db.get(
        `SELECT tr.response, a.name as agent_name
         FROM task_results tr
         LEFT JOIN agents a ON tr.agent_id = a.id
         WHERE tr.task_id = $1 AND tr.status = 'completed'
         ORDER BY tr.created_at DESC LIMIT 1`,
        [parentId]
      ) as Record<string, string> | undefined;

      if (parentTask && parentResult) {
        contextParts.push(
          `### ${parentTask.title} (by ${parentResult.agent_name})\n${parentResult.response}`
        );
      }
    }

    if (contextParts.length > 0) {
      userPrompt =
        `## Context from previous tasks:\n\n${contextParts.join('\n\n---\n\n')}\n\n---\n\n## Your Task: ${task.title}\n${task.description || 'No additional description provided.'}`;
    } else if (chainContext) {
      userPrompt = `${chainContext}\n\n---\n\n## Your Task: ${task.title}\n${task.description || 'No additional description provided.'}`;
    } else {
      userPrompt = `Task: ${task.title}\n\n${task.description || 'No additional description provided.'}`;
    }
  } else {
    userPrompt = `Task: ${task.title}\n\n${task.description || 'No additional description provided.'}`;
  }

  const startTime = Date.now();
  let response = '';
  let tokensUsed = 0;
  let toolUsageSummary: string[] = [];

  try {
    const { type, base_url: baseUrl, api_key: apiKey, model, max_tokens: maxTokens } = resolvedProvider;

    // Check if agent has tools assigned
    const agentCodename = task.agent_codename;
    const hasTools = Boolean(agentCodename);
    const tools = hasTools ? getToolsForAgent(agentCodename) : { claude: [], openai: [] };
    
    if (type === 'claude') {
      // Claude API with tool support
      const messages = [{ role: 'user' as const, content: userPrompt }];
      let maxRounds = 10;
      let currentRound = 0;
      
      while (currentRound < maxRounds) {
        currentRound++;
        
        const requestBody: any = {
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        };
        
        // Add tools if agent has them
        if (tools.claude.length > 0) {
          requestBody.tools = tools.claude;
        }
        
        const res = await fetch(`${baseUrl}/messages`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': apiKey,
            'anthropic-version': '2023-06-01',
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`Claude API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        tokensUsed += (data.usage?.input_tokens || 0) + (data.usage?.output_tokens || 0);
        
        // Check if there are tool calls
        const hasToolUse = data.content?.some((block: any) => block.type === 'tool_use');
        
        if (!hasToolUse) {
          // No tool calls, we're done
          response = data.content?.find((block: any) => block.type === 'text')?.text || '';
          break;
        }
        
        // Add assistant message with tool calls
        messages.push({
          role: 'assistant' as const,
          content: data.content
        });
        
        // Execute tool calls and collect results
        const toolResults = [];
        for (const block of data.content) {
          if (block.type === 'tool_use') {
            try {
              const result = await executeTool(block.name, block.input);
              toolResults.push({
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: JSON.stringify(result)
              });
              toolUsageSummary.push(`${block.name}(${JSON.stringify(block.input).substring(0, 100)}...)`);
            } catch (error: any) {
              toolResults.push({
                type: 'tool_result' as const,
                tool_use_id: block.id,
                content: `Error: ${error.message}`,
                is_error: true
              });
            }
          }
        }
        
        // Add tool results as user message
        if (toolResults.length > 0) {
          messages.push({
            role: 'user' as const,
            content: toolResults
          });
        }
      }
      
      if (currentRound >= maxRounds) {
        response += '\n\n[Tool use loop exceeded maximum rounds]';
      }
      
    } else {
      // OpenAI-compatible API with tool support
      const messages = [
        { role: 'system' as const, content: systemPrompt },
        { role: 'user' as const, content: userPrompt },
      ];
      let maxRounds = 10;
      let currentRound = 0;
      
      while (currentRound < maxRounds) {
        currentRound++;
        
        const requestBody: any = {
          model,
          max_tokens: maxTokens,
          messages,
        };
        
        // Add tools if agent has them
        if (tools.openai.length > 0) {
          requestBody.tools = tools.openai;
        }
        
        const res = await fetch(`${baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!res.ok) {
          const errText = await res.text();
          throw new Error(`LLM API error ${res.status}: ${errText}`);
        }

        const data = await res.json();
        tokensUsed += (data.usage?.prompt_tokens || 0) + (data.usage?.completion_tokens || 0);
        
        const message = data.choices?.[0]?.message;
        if (!message) {
          throw new Error('No message in response');
        }
        
        // Add assistant message
        messages.push(message);
        
        // Check if there are tool calls
        if (!message.tool_calls || message.tool_calls.length === 0) {
          // No tool calls, we're done
          response = message.content || '';
          break;
        }
        
        // Execute tool calls
        for (const toolCall of message.tool_calls) {
          try {
            const result = await executeTool(toolCall.function.name, JSON.parse(toolCall.function.arguments));
            messages.push({
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: JSON.stringify(result)
            });
            toolUsageSummary.push(`${toolCall.function.name}(${toolCall.function.arguments.substring(0, 100)}...)`);
          } catch (error: any) {
            messages.push({
              role: 'tool' as const,
              tool_call_id: toolCall.id,
              content: `Error: ${error.message}`
            });
          }
        }
      }
      
      if (currentRound >= maxRounds) {
        response += '\n\n[Tool use loop exceeded maximum rounds]';
      }
    }
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    const durationMs = Date.now() - startTime;

    // Reset statuses on error
    await db.run("UPDATE tasks SET status = 'todo', updated_at = NOW() WHERE id = $1", [taskId]);
    await db.run("UPDATE agents SET status = 'online', current_task_id = NULL, updated_at = NOW() WHERE id = $1", [agentId]);

    // Store error result
    const resultId = uuid();
    await db.run(`
      INSERT INTO task_results (id, task_id, agent_id, prompt, response, tokens_used, cost_usd, duration_ms, status)
      VALUES ($1, $2, $3, $4, $5, 0, 0, $6, 'error')
    `, [resultId, taskId, agentId, userPrompt, errMsg, durationMs]);

    // Log task failure activity
    await logActivity('agent_task', `Task failed: ${task.title}`, errMsg, agentId, { 
      taskId, 
      status: 'failed' 
    });

    return {
      id: resultId,
      taskId,
      agentId,
      agentName: task.agent_name,
      agentAvatar: task.agent_avatar,
      prompt: userPrompt,
      response: '',
      tokensUsed: 0,
      costUsd: 0,
      durationMs,
      status: 'error',
      error: errMsg,
    };
  }

  const durationMs = Date.now() - startTime;
  const costUsd = tokensUsed * 0.000005;

  // Append tool usage summary to response if tools were used
  let finalResponse = response;
  if (toolUsageSummary.length > 0) {
    finalResponse += `\n\n---\n**Tools used:** ${toolUsageSummary.join(', ')}`;
  }

  // Store result
  const resultId = uuid();
  await db.run(`
    INSERT INTO task_results (id, task_id, agent_id, prompt, response, tokens_used, cost_usd, duration_ms, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'completed')
  `, [resultId, taskId, agentId, userPrompt, finalResponse, tokensUsed, costUsd, durationMs]);

  // Update task status → review, update tokens
  await db.run("UPDATE tasks SET status = 'review', actual_tokens = actual_tokens + $1, updated_at = NOW() WHERE id = $2", [tokensUsed, taskId]);

  // Update agent stats
  await db.run(`
    UPDATE agents SET status = 'online', current_task_id = NULL,
      tokens_used = tokens_used + $1, cost_usd = cost_usd + $2,
      tasks_completed = tasks_completed + 1, updated_at = NOW()
    WHERE id = $3
  `, [tokensUsed, costUsd, agentId]);

  // Log task completion activity
  await logActivity('agent_task', `Task completed: ${task.title}`, `Agent ${task.agent_name} finished in ${durationMs}ms`, agentId, { 
    taskId, 
    status: 'completed', 
    tokens: tokensUsed, 
    cost: costUsd 
  });

  // Auto-create content pipeline items for social media tasks
  const socialTags = ['social', 'instagram', 'twitter', 'tiktok', 'youtube', 'caption', 'reel', 'post'];
  const taskTags = JSON.parse(task.tags || '[]');
  const isSocial = taskTags.some(t => socialTags.some(st => t.toLowerCase().includes(st)));
  if (isSocial) {
    let postsCreated = 0;

    // Try to parse structured multi-post JSON array from response
    try {
      // Look for JSON array pattern: [{"platform": ..., "caption": ...}, ...]
      const arrayMatch = finalResponse.match(/\[\s*\{[\s\S]*"(?:platform|caption)"[\s\S]*\}\s*\]/);
      if (arrayMatch) {
        const posts = JSON.parse(arrayMatch[0]);
        if (Array.isArray(posts) && posts.length > 0 && posts[0].caption) {
          for (const post of posts) {
            const platform = (post.platform || 'x').toLowerCase().replace('twitter', 'x');
            const imageUrl = post.image_url || null;
            const title = post.title || `${task.title} — ${platform}`;
            await db.run(
              'INSERT INTO content_pipeline (id, title, body, stage, platform, assigned_agent_id, thumbnail_url, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())',
              [uuid(), title, post.caption.substring(0, 5000), 'review', platform, task.assignee_id, imageUrl, JSON.stringify({ taskId: task.id, autoCreated: true })]
            );
            postsCreated++;
          }
          await logActivity('content', `${postsCreated} social posts created from: ${task.title}`, `Split into individual pipeline items`, task.assignee_id, { taskId: task.id, count: postsCreated });
        }
      }
    } catch {}

    // Fallback: single pipeline item if structured parse failed
    if (postsCreated === 0) {
      const platform = taskTags.find(t => ['instagram','twitter','tiktok','youtube','x'].some(p => t.toLowerCase().includes(p)))?.toLowerCase().replace('twitter', 'x') || 'x';
      let thumbnailUrl = null;
      try {
        const jsonMatch = finalResponse.match(/"image_url"\s*:\s*"(https?:\/\/[^"]+)"/);
        if (jsonMatch) thumbnailUrl = jsonMatch[1];
        if (!thumbnailUrl) {
          const replicateMatch = finalResponse.match(/(https:\/\/replicate\.delivery\/[^\s"']+)/);
          if (replicateMatch) thumbnailUrl = replicateMatch[1];
        }
      } catch {}
      await db.run(
        'INSERT INTO content_pipeline (id, title, body, stage, platform, assigned_agent_id, thumbnail_url, metadata, created_at, updated_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())',
        [uuid(), task.title, finalResponse.substring(0, 5000), 'review', platform, task.assignee_id, thumbnailUrl, JSON.stringify({ taskId: task.id, autoCreated: true })]
      );
      await logActivity('content', `Content created: ${task.title}`, `Auto-added to pipeline as "${platform}" content`, task.assignee_id, { taskId: task.id, stage: 'review' });
    }
  }

  // Log system message
  const msgId = uuid();
  const summary = `✅ Completed task "${task.title}" in ${(durationMs / 1000).toFixed(1)}s using ${tokensUsed} tokens ($${costUsd.toFixed(4)})`;
  await db.run("INSERT INTO messages (id, from_agent_id, content, type) VALUES ($1, $2, $3, 'system')", [msgId, agentId, summary]);

  // Notify for review
  notifyReviewReady({
    taskId,
    taskTitle: task.title,
    agentName: task.agent_name,
    agentAvatar: task.agent_avatar,
    response: finalResponse,
  });

  // Unlock dependent tasks: any task whose depends_on includes this taskId
  // and all other dependencies are done or review → move from backlog → todo
  await unlockDependentTasks(taskId);

  // Auto-review the completed task (only for successful completion)
  try {
    await processAutoReview(taskId);
  } catch (error) {
    console.error(`[AutoReview] Failed for task ${taskId}:`, error);
  }

  // If this was a Producer task, auto-create tasks from its output
  if (task.agent_codename === 'PRODUCER') {
    fetch('http://localhost:3003/api/produce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ taskId }),
    }).then(r => r.json()).then(data => {
      if (data.ok) {
        console.log(`[Producer] Auto-created ${data.created} tasks from "${task.title}"`);
      }
    }).catch(err => console.error('[Producer] Failed to auto-create tasks:', err));
  }

  return {
    id: resultId,
    taskId,
    agentId,
    agentName: task.agent_name,
    agentAvatar: task.agent_avatar,
    prompt: userPrompt,
    response: finalResponse,
    tokensUsed,
    costUsd,
    durationMs,
    status: 'completed',
  };
}

/**
 * After a task completes, find tasks that depend on it and check if they're unblocked.
 * If all dependencies are done/review, move from backlog → todo.
 */
export async function unlockDependentTasks(completedTaskId: string) {
  const db = getDb();

  // Find all tasks that have depends_on set (non-empty)
  const candidates = await db.all(
    `SELECT id, depends_on FROM tasks WHERE depends_on IS NOT NULL AND depends_on != '' AND status = 'backlog'`
  ) as Array<{ id: string; depends_on: string }>;

  for (const candidate of candidates) {
    const deps = candidate.depends_on.split(',').map((s) => s.trim()).filter(Boolean);
    if (!deps.includes(completedTaskId)) continue;

    // Check if ALL dependencies are done or review
    const allDonePromises = deps.map(async (depId) => {
      const depTask = await db.get('SELECT status FROM tasks WHERE id = $1', [depId]) as { status: string } | undefined;
      return depTask && (depTask.status === 'done' || depTask.status === 'review');
    });
    
    const allDoneResults = await Promise.all(allDonePromises);
    const allDone = allDoneResults.every(result => result);

    if (allDone) {
      await db.run("UPDATE tasks SET status = 'todo', updated_at = NOW() WHERE id = $1", [candidate.id]);
    }
  }
}
