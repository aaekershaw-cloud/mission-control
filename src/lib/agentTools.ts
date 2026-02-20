import { TOOLS, Tool } from './tools';

// Map each agent codename to their allowed tools
const AGENT_TOOLS: Record<string, string[]> = {
  'TABSMITH': ['music_theory', 'validate_tab', 'list_content', 'get_brand_context', 'delegate_task'],
  'LESSON_ARCHITECT': ['music_theory', 'list_content', 'search_tasks', 'get_brand_context', 'delegate_task'],
  'TRACKMASTER': ['music_theory', 'list_content', 'get_brand_context', 'delegate_task'],
  'THEORYBOT': ['music_theory', 'list_content', 'search_tasks', 'get_brand_context', 'delegate_task'],
  'COACH': ['music_theory', 'list_content', 'search_tasks', 'get_brand_context', 'delegate_task'],
  'FEEDBACK_LOOP': ['list_content', 'search_tasks', 'get_brand_context', 'delegate_task'],
  'CONTENT_MILL': ['search_web', 'fetch_url', 'list_content', 'get_brand_context', 'write_content', 'generate_image', 'delegate_task'],
  'CONTENTMILL': ['search_web', 'fetch_url', 'list_content', 'get_brand_context', 'write_content', 'generate_image', 'delegate_task'],
  'SEOHAWK': ['search_web', 'fetch_url', 'list_content', 'get_brand_context', 'delegate_task'],
  'COMMUNITY_PULSE': ['search_web', 'fetch_url', 'list_content', 'get_brand_context', 'delegate_task'],
  'BIZOPS': ['search_web', 'fetch_url', 'list_content', 'search_tasks', 'get_brand_context', 'delegate_task'],
  'PRODUCER': ['list_content', 'search_tasks', 'get_brand_context', 'delegate_task'],
};

/**
 * Get tools available for a specific agent by codename
 * Returns array of tool definitions formatted for API calls
 */
export function getToolsForAgent(codename: string): { claude: any[]; openai: any[] } {
  const allowedToolNames = AGENT_TOOLS[codename] || [];
  const availableTools = TOOLS.filter(tool => allowedToolNames.includes(tool.name));
  
  // Format for Claude API
  const claudeTools = availableTools.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters
  }));
  
  // Format for OpenAI API
  const openaiTools = availableTools.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters
    }
  }));
  
  return { claude: claudeTools, openai: openaiTools };
}

/**
 * Execute a tool by name with given parameters
 */
export async function executeTool(name: string, params: any, callerContext?: { agentId: string; agentName: string; agentAvatar: string; agentCodename: string }): Promise<any> {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Tool "${name}" not found`);
  }
  
  try {
    // Inject caller context for tools that need it (e.g. delegate_task)
    if (callerContext) {
      params = { ...params, _callerContext: callerContext };
    }
    return await tool.execute(params);
  } catch (error: any) {
    throw new Error(`Tool "${name}" execution failed: ${error.message}`);
  }
}

/**
 * Check if an agent has access to a specific tool
 */
export function hasToolAccess(codename: string, toolName: string): boolean {
  const allowedTools = AGENT_TOOLS[codename] || [];
  return allowedTools.includes(toolName);
}

/**
 * Get list of all available tools (for API endpoint)
 */
export function getAllTools(): Tool[] {
  return TOOLS;
}

/**
 * Get agent tool mapping (for debugging/admin)
 */
export function getAgentToolMapping(): Record<string, string[]> {
  return AGENT_TOOLS;
}