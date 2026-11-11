/** The database harness must fail closed before opening a connection when the
 * explicit disposable database configuration is missing or unsafe. */
import { afterEach, expect, it, vi } from 'vitest';
import { pollDatabase } from './pollDatabase';

afterEach(() => vi.unstubAllEnvs());

it('never falls back to the application DATABASE_URL', async () => {
  vi.stubEnv('DATABASE_URL', 'postgresql://localhost/application');
  vi.stubEnv('POLL_TEST_DATABASE_URL', '');
  await expect(pollDatabase()).rejects.toThrow(
    'POLL_TEST_DATABASE_URL is required'
  );
});

it.each([
  'postgresql://remote.example/disposable_test',
  'postgresql://localhost/application',
])('rejects unsafe test target %s', async (url) => {
  vi.stubEnv('POLL_TEST_DATABASE_URL', url);
  await expect(pollDatabase()).rejects.toThrow(
    'localhost database ending in _test'
  );
});
