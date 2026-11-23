/** Verify poller authentication and the public response shape without contacting a provider. */
import { afterEach, expect, it, vi } from 'vitest';
const { execute } = vi.hoisted(() => ({
  execute: vi.fn(async () => ({ success: true, value: { submitted: 1 } })),
}));
vi.mock('@/infrastructure/anchor/createSealRecovery', () => ({
  createSealRecovery: () => ({ execute }),
}));
vi.mock('@/infrastructure/database/prisma', () => ({ prisma: {} }));
import * as route from '../route';
afterEach(() => {
  vi.unstubAllEnvs();
  vi.clearAllMocks();
});

function request(token?: string, body?: string) {
  return new Request('http://localhost/api/internal/anchors/upgrade', {
    method: 'POST',
    headers: token ? { authorization: token } : {},
    body,
  });
}

it.each([
  [undefined, undefined],
  ['', 'Bearer'],
  [' ', 'Bearer x'],
  ['secret', 'secret'],
  ['secret', 'Bearer wrong'],
  ['secret', 'Bearer secret extra'],
])('rejects malformed or missing credentials', async (secret, header) => {
  vi.stubEnv('ANCHOR_POLLER_SECRET', secret);
  expect((await route.POST(request(header))).status).toBe(401);
  expect(execute).not.toHaveBeenCalled();
});
it('accepts authenticated concurrent ticks and returns counts', async () => {
  vi.stubEnv('ANCHOR_POLLER_SECRET', 'secret');
  const responses = await Promise.all([
    route.POST(request('Bearer secret')),
    route.POST(request('Bearer secret')),
  ]);

  for (const response of responses) {
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ submitted: 1 });
  }

  expect(execute).toHaveBeenCalledTimes(2);
  expect(route).not.toHaveProperty('GET');
  expect(
    (await route.POST(request('Bearer secret', 'unexpected'))).status
  ).toBe(400);
});

it('accepts an authenticated POST represented as a zero-byte body stream', async () => {
  vi.stubEnv('ANCHOR_POLLER_SECRET', 'secret');
  expect((await route.POST(request('Bearer secret', ''))).status).toBe(200);
});
