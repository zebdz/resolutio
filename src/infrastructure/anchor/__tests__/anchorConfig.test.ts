/** Production must explicitly select real timestamps and authenticate its poller. */
import { expect, it, vi } from 'vitest';
import {
  readAnchorConfig,
  createAnchorProvider,
} from '../anchorProviderFactory';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { Digest } from '@/domain/seal/SealValues';

it.each([undefined, 'stub', 'other'])(
  'refuses production provider %s',
  (value) => {
    expect(
      readAnchorConfig({
        NODE_ENV: 'production',
        ANCHOR_PROVIDER: value,
        ANCHOR_POLLER_SECRET: 'test-secret',
      }).success
    ).toBe(false);
  }
);
it.each([undefined, '', '   ', 'token with spaces'])(
  'requires a usable production bearer',
  (secret) => {
    expect(
      readAnchorConfig({
        NODE_ENV: 'production',
        ANCHOR_PROVIDER: 'opentimestamps',
        ANCHOR_POLLER_SECRET: secret,
      }).success
    ).toBe(false);
  }
);
it('marks development submissions and upgrades as simulated', async () => {
  const provider = createAnchorProvider(
    expectSuccess(readAnchorConfig({ NODE_ENV: 'development' }))
  );
  const digest = Digest.parse('ab'.repeat(32));
  const submitted = expectSuccess(await provider.submit(digest));
  expect(submitted.kind).toBe('simulated');
  expect(
    expectSuccess(await provider.upgrade(digest, submitted.proof)).kind
  ).toBe('simulated');
});

it('restricts simulated providers to an explicit development or test environment', () => {
  expect(
    readAnchorConfig({ NODE_ENV: 'staging', ANCHOR_PROVIDER: 'stub' }).success
  ).toBe(false);
  expect(readAnchorConfig({}).success).toBe(false);
});

it('terminates the Next node process at startup on invalid production settings', async () => {
  vi.stubEnv('NEXT_RUNTIME', 'nodejs');
  vi.stubEnv('NODE_ENV', 'production');
  vi.stubEnv('ANCHOR_PROVIDER', 'stub');
  const exit = vi.spyOn(process, 'exit').mockImplementation(() => {
    throw new Error('EXIT');
  });

  try {
    const { register } = await import('@/src/instrumentation');
    await expect(register()).rejects.toThrow('EXIT');
    expect(exit).toHaveBeenCalledWith(1);
  } finally {
    exit.mockRestore();
    vi.unstubAllEnvs();
  }
});
