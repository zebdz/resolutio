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
  let body: object = counts;
  const server = createServer((_req, res) =>
    res.writeHead(status).end(JSON.stringify(body))
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
    const pollIds = {
      submitted: ['poll-1'],
      pending: ['poll-2'],
      confirmed: ['poll-3'],
    };
    body = { ...counts, submitted: 1, pending: 1, confirmed: 1, pollIds };
    expect(JSON.parse((await run()).stdout)).toMatchObject({
      pollIds,
      level: 'info',
    });
    body = {
      ...counts,
      failed: 1,
      errors: 1,
      pollIds: { failed: ['poll-4'], errors: ['poll-5'] },
    };
    await expect(run()).rejects.toMatchObject({
      code: 1,
      stderr: expect.stringContaining(
        '"pollIds":{"failed":["poll-4"],"errors":["poll-5"]}'
      ),
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
