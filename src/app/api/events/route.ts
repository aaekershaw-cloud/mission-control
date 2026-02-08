export const dynamic = 'force-dynamic';

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      // Send initial connection event
      controller.enqueue(
        encoder.encode(`event: connected\ndata: ${JSON.stringify({ status: 'connected', timestamp: new Date().toISOString() })}\n\n`)
      );

      // Send heartbeat pings every 5 seconds to keep the connection alive
      const interval = setInterval(() => {
        try {
          controller.enqueue(
            encoder.encode(`event: ping\ndata: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`)
          );
        } catch {
          clearInterval(interval);
        }
      }, 5000);

      // Clean up on cancel
      const originalCancel = controller.close.bind(controller);
      const checkClosed = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(''));
        } catch {
          clearInterval(interval);
          clearInterval(checkClosed);
          try {
            originalCancel();
          } catch {
            // Already closed
          }
        }
      }, 10000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
