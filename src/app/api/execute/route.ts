import { NextRequest, NextResponse } from 'next/server';
import { executeTask, ProviderOverride } from '@/lib/executor';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { taskId, providerConfig } = body;

    if (!taskId) {
      return NextResponse.json({ error: 'Missing taskId' }, { status: 400 });
    }

    // If client supplies a providerConfig (from localStorage UI), use it as override
    let providerOverride: ProviderOverride | undefined;
    if (providerConfig && providerConfig.apiKey) {
      providerOverride = {
        type: providerConfig.type,
        baseUrl: providerConfig.baseUrl,
        apiKey: providerConfig.apiKey,
        model: providerConfig.model,
        maxTokens: providerConfig.maxTokens,
      };
    }

    const result = await executeTask(taskId, providerOverride);

    if (result.status === 'error') {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    return NextResponse.json(result);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
