/** The same private file used by cron must be discoverable through the superadmin viewer. */
import { expect, it, vi } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NextRequest } from 'next/server';
import { GET as readLog } from '@/src/app/api/superadmin/logs/[id]/read/route';
import { PollId } from '@/domain/seal/SealValues';
import { writeSealRecoveryIssue } from '../sealWorkerLog';
import { getLogSource, isArchivedFileJson } from '../logSources';

vi.mock('@/web/lib/superadminApiAuth', () => ({
  requireSuperadminApi: async () => ({ userId: 'operator', error: null }),
}));

it('lists the existing seal worker file and recognises its JSON archives', () => {
  expect(getLogSource('seal-worker')).toMatchObject({
    path: 'seal-worker.log',
    json: true,
  });
  expect(isArchivedFileJson('seal-worker.log.2026-11-23.zip')).toBe(true);
});

it('appends timestamped diagnostic codes to the file the viewer reads', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'seal-worker-log-'));
  vi.spyOn(process, 'cwd').mockReturnValue(directory);

  try {
    const previous = '{"submitted":0,"errors":0}';
    await writeFile(join(directory, 'seal-worker.log'), previous + '\n', {
      mode: 0o600,
    });
    await writeSealRecoveryIssue('cron', {
      pollId: PollId.parse('test-poll'),
      operation: 'anchor',
      code: 'domain.seal.anchorIllegalTransition',
    });
    const response = await readLog(
      new NextRequest('http://localhost/api/superadmin/logs/seal-worker/read'),
      { params: Promise.resolve({ id: 'seal-worker' }) }
    );
    expect(response.status).toBe(200);
    const { lines } = await response.json();
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(previous);
    expect(JSON.parse(lines[1])).toEqual({
      timestamp: expect.stringMatching(/Z$/),
      source: 'cron',
      level: 'error',
      pollId: 'test-poll',
      operation: 'anchor',
      code: 'domain.seal.anchorIllegalTransition',
    });
  } finally {
    vi.restoreAllMocks();
    await rm(directory, { recursive: true, force: true });
  }
});
