import { NextRequest, NextResponse } from 'next/server';
import { getAllTools, executeTool } from '@/lib/agentTools';

/**
 * GET /api/tools - Returns all available tools with their descriptions
 */
export async function GET() {
  try {
    const tools = getAllTools();
    
    const toolsInfo = tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));

    return NextResponse.json({
      ok: true,
      tools: toolsInfo,
      count: toolsInfo.length,
    });
  } catch (error: any) {
    console.error('[Tools API] GET error:', error);
    return NextResponse.json(
      { ok: false, error: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tools - Test a tool execution
 * Body: { tool: string, params: object }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tool, params } = body;

    if (!tool) {
      return NextResponse.json(
        { ok: false, error: 'Tool name is required' },
        { status: 400 }
      );
    }

    if (!params || typeof params !== 'object') {
      return NextResponse.json(
        { ok: false, error: 'Params object is required' },
        { status: 400 }
      );
    }

    const startTime = Date.now();
    const result = await executeTool(tool, params);
    const duration = Date.now() - startTime;

    return NextResponse.json({
      ok: true,
      tool,
      params,
      result,
      duration_ms: duration,
    });
  } catch (error: any) {
    console.error('[Tools API] POST error:', error);
    return NextResponse.json(
      { 
        ok: false, 
        error: error.message
      },
      { status: 400 }
    );
  }
}