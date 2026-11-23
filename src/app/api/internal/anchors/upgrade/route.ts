/** Authenticated cron entry point. Return batch counts and poll IDs by outcome for the private scheduler log. */
import { writeSealRecoveryIssue } from '@/infrastructure/logs/sealWorkerLog';
import { createHash, timingSafeEqual } from 'node:crypto';
import { createSealRecovery } from '@/infrastructure/anchor/createSealRecovery';
import { prisma } from '@/infrastructure/database/prisma';
import { readAnchorConfig } from '@/infrastructure/anchor/anchorProviderFactory';

export async function POST(request: Request): Promise<Response> {
  const config = readAnchorConfig(process.env);
  const supplied = request.headers.get('authorization');

  if (!config.success || !config.value.pollerSecret || !supplied) {
    return new Response(null, { status: 401 });
  }

  const hash = (value: string) => createHash('sha256').update(value).digest();

  if (
    !timingSafeEqual(
      hash(supplied),
      hash('Bearer ' + config.value.pollerSecret)
    )
  ) {
    return new Response(null, { status: 401 });
  }

  if (request.body !== null) {
    const reader = request.body.getReader();

    try {
      for (;;) {
        const chunk = await reader.read();

        if (chunk.done) {
          break;
        }

        if (chunk.value.byteLength > 0) {
          void reader.cancel();

          return new Response(null, { status: 400 });
        }
      }
    } finally {
      reader.releaseLock();
    }
  }

  const result = await createSealRecovery(prisma, config.value).execute(
    (issue) => writeSealRecoveryIssue('cron', issue)
  );

  return result.success
    ? Response.json(result.value)
    : new Response(null, { status: 503 });
}
