import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AddressQuotaLogger } from '../AddressQuotaLogger';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'addr-quota-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function readLines(): Promise<Record<string, unknown>[]> {
  const raw = await fs.readFile(path.join(dir, 'address-quota.log'), 'utf8');

  return raw
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
}

describe('AddressQuotaLogger', () => {
  it('logs a cap-reached entry as JSON with a timestamp', async () => {
    const logger = new AddressQuotaLogger(dir);

    await logger.logCapReached({
      route: 'suggest',
      dailyMax: 9500,
      retryAfterSeconds: 3600,
      fellBackToNominatim: true,
    });

    const [entry] = await readLines();

    expect(entry.level).toBe('warn');
    expect(entry.event).toBe('daily_cap_reached');
    expect(entry.route).toBe('suggest');
    expect(entry.dailyMax).toBe(9500);
    expect(entry.fellBackToNominatim).toBe(true);
    expect(typeof entry.timestamp).toBe('string');
  });

  it('logs a DaData 429 as an error-level entry', async () => {
    const logger = new AddressQuotaLogger(dir);

    await logger.logQuotaRejected({ route: 'flats', statusCode: 429 });

    const [entry] = await readLines();

    expect(entry.level).toBe('error');
    expect(entry.event).toBe('dadata_quota_rejected');
    expect(entry.statusCode).toBe(429);
  });

  it('appends rather than overwriting', async () => {
    const logger = new AddressQuotaLogger(dir);

    await logger.logQuotaRejected({ route: 'suggest', statusCode: 429 });
    await logger.logQuotaRejected({ route: 'flats', statusCode: 429 });

    expect(await readLines()).toHaveLength(2);
  });

  it('never throws when the log directory cannot be written', async () => {
    // Logging must never take down an address lookup.
    // Point logsDir at an existing FILE: mkdir then fails ENOTDIR immediately, on every
    // platform. Do NOT use a /proc path — mkdir under procfs hangs in some sandboxes
    // instead of rejecting, which turns this into a flaky timeout rather than a test.
    const filePath = path.join(dir, 'iam-a-file');
    await fs.writeFile(filePath, 'x');

    const logger = new AddressQuotaLogger(filePath);

    await expect(
      logger.logQuotaRejected({ route: 'suggest', statusCode: 429 })
    ).resolves.toBeUndefined();
  });
});
