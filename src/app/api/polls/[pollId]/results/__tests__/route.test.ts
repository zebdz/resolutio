/** The HTTP boundary owns session/setup checks and serializes only permitted results.
 * Guest and revoked requests must fail before loading reports or navigation details. */
import { beforeEach, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  limit: vi.fn(),
  moderate: vi.fn(),
  read: vi.fn(),
  extras: vi.fn(),
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.session }));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: mocks.limit }));
vi.mock('@/application/user/getUserModerationAccess', () => ({
  getUserModerationAccess: mocks.moderate,
}));
vi.mock('@/web/lib/readPollResults', () => ({ readPollResults: mocks.read }));
vi.mock('@/web/lib/resultsPageDetails', () => ({
  resultsPageDetails: mocks.extras,
}));
import { GET } from '../route';

const invoke = () =>
  GET(new Request('http://localhost/api/polls/poll-1/results'), {
    params: Promise.resolve({ pollId: 'poll-1' }),
  });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.session.mockResolvedValue({
    id: 'viewer',
    firstName: 'J',
    isConfirmed: () => true,
    privacySetupCompleted: true,
  });
  mocks.moderate.mockResolvedValue({ success: true, value: 'allowed' });
});

it('keeps a revoked poll out of JSON and prevents supplementary reads', async () => {
  mocks.read.mockResolvedValue({
    success: false,
    error: 'domain.poll.pollResultsNotOrgMember',
  });
  const response = await invoke();
  expect(response.status).toBe(403);
  expect(response.headers.get('cache-control')).toBe('private, no-store');
  expect(await response.json()).toEqual({
    error: 'domain.poll.pollResultsNotOrgMember',
  });
  expect(mocks.extras).not.toHaveBeenCalled();
});

it.each([
  { user: null, next: '/login', status: 401 },
  {
    user: { isConfirmed: (): boolean => false },
    next: '/confirm-phone',
    status: 403,
  },
  {
    user: { isConfirmed: (): boolean => true, privacySetupCompleted: false },
    next: '/privacy-setup',
    status: 403,
  },
])(
  'applies the $next gate before loading results',
  async ({ user, next, status }) => {
    mocks.session.mockResolvedValue(user);
    const response = await invoke();
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ next });
    expect(mocks.read).not.toHaveBeenCalled();
  }
);

it('applies rate limiting before resolving the session', async () => {
  mocks.limit.mockResolvedValue({ success: false, error: 'limited' });
  const response = await invoke();
  expect(response.status).toBe(429);
  expect(mocks.session).not.toHaveBeenCalled();
});

it('returns an uncached localized error code if storage becomes unavailable', async () => {
  mocks.read.mockRejectedValue(new Error('storage went away'));
  const response = await invoke();
  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({ error: 'common.errors.unexpected' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});

it('returns only the authorized JSON view and keeps a storage error out of the browser', async () => {
  mocks.read.mockResolvedValue({ success: true, value: { kind: 'sealed' } });
  mocks.extras.mockResolvedValue({
    success: true,
    value: { title: 'Frozen assembly' },
  });
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ title: 'Frozen assembly' });
  expect(response.headers.get('cache-control')).toBe('private, no-store');
});
