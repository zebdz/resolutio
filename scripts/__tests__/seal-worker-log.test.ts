/** Exercise the cron entry point against a local worker response and validate the
 * JSON lines the installed cron redirects into the superadmin log. */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { createServer } from 'node:http';
import { expect, it } from 'vitest';

it('logs a dated run summary on idle ticks and a dated error on HTTP failures', async () => {
  const counts = {
    submitted: 0,
    confirmed: 0,
    pending: 0,
    failed: 0,
    idle: 0,
    busy: 0,
    errors: 0,
    deliveries: 0,
  };
  let status = 200;
  const server = createServer((_req, res) =>
    res.writeHead(status).end(JSON.stringify(counts))
  );
  server.listen(0, '127.0.0.1');

  try {
    await once(server, 'listening');
    const address = server.address();

    if (!address || typeof address === 'string') {
      throw new Error('missing test port');
    }

    const run = () =>
      promisify(execFile)(process.execPath, ['scripts/seal-ops/worker.mjs'], {
        env: {
          ...process.env,
          PORT: String(address.port),
          ANCHOR_POLLER_SECRET: 'fixture',
        },
      });
    const result = await run();
    expect(JSON.parse(result.stdout)).toEqual({
      ...counts,
      timestamp: expect.stringMatching(/Z$/),
      level: 'info',
      source: 'cron',
    });
    status = 503;
    await expect(run()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringMatching(/"timestamp":.*"error":"Worker HTTP 503"/),
    });
  } finally {
    server.close();
  }
});
