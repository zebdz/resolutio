/** Stale-analysis updates require server authorization and rate limiting before persistence. */
import { beforeEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  rateLimit: vi.fn(),
  markStale: vi.fn(),
  poll: vi.fn(),
  isAdmin: vi.fn(),
  isSuper: vi.fn(),
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.currentUser }));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: vi.fn(async (code) => code),
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaPollRepository: class {
    getPollById = mocks.poll;
  },
  PrismaOrganizationRepository: class {
    isUserAdmin = mocks.isAdmin;
  },
  PrismaUserRepository: class {
    isSuperAdmin = mocks.isSuper;
  },
}));
vi.mock('@/infrastructure/repositories/PrismaLegalCheckRepository', () => ({
  PrismaLegalCheckRepository: class {
    markStale = mocks.markStale;
  },
}));
import { markLegalCheckStaleAction } from '../getLegalCheck';
beforeEach(() => {
  vi.resetAllMocks();
  mocks.rateLimit.mockResolvedValue(null);
  mocks.currentUser.mockResolvedValue(null);
});
it('does not let an unauthenticated caller mark a check stale', async () => {
  await markLegalCheckStaleAction('poll-1');
  expect(mocks.markStale).not.toHaveBeenCalled();
});
it('enforces the rate limit before reading session or persistence', async () => {
  mocks.rateLimit.mockResolvedValue({ success: false, error: 'limited' });
  await markLegalCheckStaleAction('poll-1');
  expect(mocks.currentUser).not.toHaveBeenCalled();
  expect(mocks.markStale).not.toHaveBeenCalled();
});
it('requires admin access to the poll organization', async () => {
  mocks.currentUser.mockResolvedValue({ id: 'u-1' });
  mocks.poll.mockResolvedValue({
    success: true,
    value: { id: 'poll-1', organizationId: 'org-1' },
  });
  mocks.isSuper.mockResolvedValue(false);
  mocks.isAdmin.mockResolvedValue(false);
  await markLegalCheckStaleAction('poll-1');
  expect(mocks.markStale).not.toHaveBeenCalled();
  mocks.isAdmin.mockResolvedValue(true);
  await markLegalCheckStaleAction('poll-1');
  expect(mocks.markStale).toHaveBeenCalledWith('poll-1');
});
