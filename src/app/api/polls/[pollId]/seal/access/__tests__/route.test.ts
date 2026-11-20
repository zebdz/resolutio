/** Viewer hints never disclose account or poll contents, including to an authenticated voter who lost access. */
import { beforeEach, expect, it, vi } from 'vitest';
import { success } from '@/domain/shared/Result';
const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  permissions: vi.fn(),
  after: vi.fn(),
  nudge: vi.fn(),
}));
vi.mock('next/server', () => ({ after: mocks.after }));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/infrastructure/database/prisma', () => ({ prisma: {} }));
vi.mock('@/infrastructure/repositories/PrismaSealPermissions', () => ({
  PrismaSealPermissions: class {
    forViewer = mocks.permissions;
  },
}));
vi.mock('@/infrastructure/anchor/createSealRecovery', () => ({
  createSealRecovery: () => ({ nudge: mocks.nudge }),
}));
const { GET } = await import('../route');
const context = { params: Promise.resolve({ pollId: 'poll1' }) };
const request = new Request(
  'https://example.test/api/polls/poll1/seal/access?recover=1'
);
beforeEach(() => {
  vi.resetAllMocks();
  mocks.nudge.mockResolvedValue(success('idle'));
});

it('responds to revoked voters with a private capability only', async () => {
  mocks.user.mockResolvedValue({
    id: 'privateAccount',
    name: 'Private Person',
    email: 'private@example.test',
  });
  mocks.permissions.mockResolvedValue(
    success({ results: false, names: false, signers: false })
  );
  const result = await GET(request, context);
  expect(await result.json()).toEqual({ viewer: 'signedIn' });
  expect(result.headers.get('cache-control')).toBe('private, no-store');
  expect(mocks.permissions).toHaveBeenCalledWith('poll1', 'privateAccount');
});

it('reveals only the results capability for authorized viewers', async () => {
  mocks.user.mockResolvedValue({ id: 'privateAccount' });
  mocks.permissions.mockResolvedValue(
    success({ results: true, names: true, signers: true })
  );
  const response = await GET(
    new Request('https://example.test/api/polls/poll1/seal/access'),
    context
  );
  expect(await response.json()).toEqual({ viewer: 'sections' });
  expect(mocks.after).not.toHaveBeenCalled();
});

it('runs missing or pending recovery outside the public render, including for a guest', async () => {
  mocks.user.mockResolvedValue(null);
  const response = await GET(request, context);
  expect(await response.json()).toEqual({ viewer: 'guest' });
  expect(mocks.permissions).not.toHaveBeenCalled();
  expect(mocks.after).toHaveBeenCalledOnce();
  await mocks.after.mock.calls[0][0]();
  expect(mocks.nudge).toHaveBeenCalledWith('poll1');
});

it('returns a private empty error response on a failed permission read', async () => {
  mocks.user.mockResolvedValue({ id: 'privateAccount' });
  mocks.permissions.mockResolvedValue({
    success: false,
    error: 'common.errors.unexpected',
  });
  const response = await GET(request, context);
  expect(response.status).toBe(503);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.text()).toBe('');
});
