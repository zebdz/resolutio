// Local scheduler client. Log dated counts and affected poll IDs for the superadmin.
// Fixed loopback destination and disabled redirects keep it off the public network.
import 'dotenv/config';
import { z } from 'zod';

const port = process.env.PORT ?? '3000';
const outcomes = [
  'submitted',
  'confirmed',
  'pending',
  'failed',
  'idle',
  'busy',
  'errors',
];
const fields = [...outcomes, 'deliveries'];
const pollGroups = z.partialRecord(
  z.enum(outcomes),
  z.array(z.string().regex(/^[A-Za-z0-9_-]{1,256}$/))
);

async function run() {
  if (
    !/^\d{1,5}$/.test(port) ||
    Number(port) < 1 ||
    Number(port) > 65535 ||
    !process.env.ANCHOR_POLLER_SECRET
  ) {
    return { error: 'Invalid worker configuration' };
  }

  const response = await fetch(
    `http://127.0.0.1:${port}/api/internal/anchors/upgrade`,
    {
      method: 'POST',
      redirect: 'error',
      headers: {
        Authorization: 'Bearer ' + process.env.ANCHOR_POLLER_SECRET,
        'X-Forwarded-Proto': 'https',
      },
    }
  );

  if (!response.ok) {
    return { error: 'Worker HTTP ' + response.status };
  }

  const body = await response.json();
  const counts = Object.fromEntries(fields.map((key) => [key, body[key]]));

  if (!Object.values(counts).every((n) => Number.isSafeInteger(n) && n >= 0)) {
    return { error: 'Invalid worker counts' };
  }

  // A server on the preceding release returns counts alone.
  if (body.pollIds === undefined) {
    return { counts };
  }

  const ids = pollGroups.safeParse(body.pollIds);

  if (
    !ids.success ||
    outcomes.some((key) => (ids.data[key]?.length ?? 0) !== counts[key])
  ) {
    return { error: 'Invalid worker poll IDs' };
  }

  return { counts, pollIds: ids.data };
}

function log(level, data) {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    source: 'cron',
    level,
    ...data,
  });

  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

try {
  const result = await run();

  if (result.error) {
    log('error', { error: result.error });
    process.exitCode = 1;
  } else {
    const failed = result.counts.errors > 0 || result.counts.failed > 0;
    log(failed ? 'error' : 'info', {
      ...result.counts,
      pollIds: result.pollIds,
    });

    if (failed) {
      process.exitCode = 1;
    }
  }
} catch {
  log('error', {
    error:
      'Poll seal worker failed. Check service status and bearer configuration.',
  });
  process.exitCode = 1;
}
