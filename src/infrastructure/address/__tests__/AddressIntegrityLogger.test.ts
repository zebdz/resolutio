import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { AddressIntegrityLogger } from '../AddressIntegrityLogger';

let dir: string;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'addr-integrity-'));
});

afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

async function readLines(): Promise<Record<string, unknown>[]> {
  const raw = await fs.readFile(
    path.join(dir, 'address-integrity.log'),
    'utf8'
  );

  return raw
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l));
}

describe('AddressIntegrityLogger', () => {
  it('logs an unreadable-address entry as JSON with a timestamp', async () => {
    const logger = new AddressIntegrityLogger(dir);

    await logger.logUnreadableAddress({
      userId: 'user-1',
      reason: 'domain.user.address.apartmentRequired',
      method: 'searchUsers',
    });

    const [entry] = await readLines();

    expect(entry.level).toBe('error');
    expect(entry.event).toBe('unreadable_address');
    expect(entry.userId).toBe('user-1');
    expect(entry.reason).toBe('domain.user.address.apartmentRequired');
    expect(entry.method).toBe('searchUsers');
    expect(typeof entry.timestamp).toBe('string');
  });

  it('appends rather than overwriting', async () => {
    const logger = new AddressIntegrityLogger(dir);

    await logger.logUnreadableAddress({
      userId: 'user-1',
      reason: 'domain.user.address.apartmentRequired',
      method: 'searchUsers',
    });
    await logger.logUnreadableAddress({
      userId: 'user-2',
      reason: 'domain.user.address.apartmentRequired',
      method: 'searchUsers',
    });

    expect(await readLines()).toHaveLength(2);
  });

  it('never throws when the log directory cannot be written', async () => {
    // Logging must never take down a user list read.
    // Point logsDir at an existing FILE: mkdir then fails ENOTDIR immediately, on every
    // platform. Do NOT use a /proc path — mkdir under procfs hangs in some sandboxes
    // instead of rejecting, which turns this into a flaky timeout rather than a test.
    const filePath = path.join(dir, 'iam-a-file');
    await fs.writeFile(filePath, 'x');

    const logger = new AddressIntegrityLogger(filePath);

    await expect(
      logger.logUnreadableAddress({
        userId: 'user-1',
        reason: 'domain.user.address.apartmentRequired',
        method: 'searchUsers',
      })
    ).resolves.toBeUndefined();
  });
});
