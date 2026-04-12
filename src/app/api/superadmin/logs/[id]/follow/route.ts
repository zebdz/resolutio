import fs from 'fs';
import { NextRequest, NextResponse } from 'next/server';
import { requireSuperadminApi } from '@/web/lib/superadminApiAuth';
import { getLogSource, resolveLogPath } from '@/infrastructure/logs/logSources';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requireSuperadminApi();

  if (auth.error) {
    return auth.error;
  }

  const { id } = await params;
  const source = getLogSource(id);

  if (!source) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const filePath = resolveLogPath(source);

  if (!fs.existsSync(filePath)) {
    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  }

  const encoder = new TextEncoder();
  let lastSize = fs.statSync(filePath).size;

  const stream = new ReadableStream({
    start(controller) {
      // Watch for file changes
      const watcher = fs.watch(filePath, () => {
        try {
          const stat = fs.statSync(filePath);

          // Truncation detection
          if (stat.size < lastSize) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: 'truncated' })}\n\n`
              )
            );
            lastSize = stat.size;

            return;
          }

          if (stat.size > lastSize) {
            // Read new bytes
            const fd = fs.openSync(filePath, 'r');
            const buffer = Buffer.alloc(stat.size - lastSize);
            fs.readSync(fd, buffer, 0, buffer.length, lastSize);
            fs.closeSync(fd);

            const newContent = buffer.toString('utf-8');
            const newLines = newContent
              .split('\n')
              .filter((line) => line.length > 0);

            for (const line of newLines) {
              controller.enqueue(
                encoder.encode(
                  `data: ${JSON.stringify({ type: 'line', data: line })}\n\n`
                )
              );
            }

            lastSize = stat.size;
          }
        } catch {
          // File may have been deleted/moved
        }
      });

      // Heartbeat every 15s
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'));
        } catch {
          clearInterval(heartbeat);
        }
      }, 15000);

      // Cleanup on abort
      request.signal.addEventListener('abort', () => {
        watcher.close();
        clearInterval(heartbeat);

        try {
          controller.close();
        } catch {
          // already closed
        }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
