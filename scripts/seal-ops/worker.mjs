// Local scheduler client. Load the bearer from the private site environment.
// Fixed loopback destination and disabled redirects keep it off the public network.
import 'dotenv/config';

const port = process.env.PORT ?? '3000';
const fields = [
  'submitted',
  'confirmed',
  'pending',
  'failed',
  'idle',
  'busy',
  'errors',
  'deliveries',
];

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

  return { counts };
}

try {
  const result = await run();

  if (result.error) {
    console.error(result.error);
    process.exitCode = 1;
  } else {
    console.log(JSON.stringify(result.counts));

    if (result.counts.errors || result.counts.failed) {
      process.exitCode = 1;
    }
  }
} catch {
  console.error(
    'Poll seal worker failed. Check service status and bearer configuration.'
  );
  process.exitCode = 1;
}
