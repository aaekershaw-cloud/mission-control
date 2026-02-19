import { TOOLS, Tool } from './tools';

// Map each agent codename to their allowed tools
const AGENT_TOOLS: Record<string, string[]> = {
  'TABSMITH': ['music_theory', 'validate_tab', 'list_content', 'get_brand_context'],
  'LESSON_ARCHITECT': ['music_theory', 'list_content', 'search_tasks', 'get_brand_context'],
  'TRACKMASTER': ['music_theory', 'list_content', 'get_brand_context'],
  'THEORYBOT': ['music_theory', 'list_content', 'search_tasks', 'get_brand_context'],
  'COACH': ['music_theory', 'list_content', 'search_tasks', 'get_brand_context'],
  'FEEDBACK_LOOP': ['list_content', 'search_tasks', 'get_brand_context'],
  'CONTENT_MILL': ['search_web', 'fetch_url', 'list_content', 'get_brand_context', 'write_content', 'generate_image'],
  'CONTENTMILL': ['search_web', 'fetch_url', 'list_content', 'get_brand_context', 'write_content', 'generate_image'],
  'SEOHAWK': ['search_web', 'fetch_url', 'list_content', 'get_brand_context'],
  'COMMUNITY_PULSE': ['search_web', 'fetch_url', 'list_content', 'get_brand_context'],
  'BIZOPS': ['search_web', 'fetch_url', 'list_content', 'search_tasks', 'get_brand_context'],
  'PRODUCER': ['list_content', 'search_tasks', 'get_brand_context'],
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
export async function executeTool(name: string, params: any): Promise<any> {
  const tool = TOOLS.find(t => t.name === name);
  if (!tool) {
    throw new Error(`Tool "${name}" not found`);
  }
  
  try {
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