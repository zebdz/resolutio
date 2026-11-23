/** Check the actual private HTTP body and denial gates. A revoked voter retains
 * only their own code and paths, with no protected labels or raw session fields. */
import { beforeEach, expect, it, vi } from 'vitest';
import fixture from '@/domain/seal/__tests__/fixtures/record-v1.json';
import { PollSeal } from '@/domain/seal/PollSeal';
import { success } from '@/domain/shared/Result';
import { SealExports } from '@/application/seal/SealExports';

const mocks = vi.hoisted(() => ({
  user: vi.fn(),
  myProof: vi.fn(),
  proof: vi.fn(),
  participant: vi.fn(),
  moderation: vi.fn(),
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.user }));
vi.mock('@/web/lib/sealDownload', () => ({
  sealExports: { myProof: mocks.myProof, proof: mocks.proof },
}));
vi.mock('@/infrastructure/database/prisma', () => ({ prisma: {} }));
vi.mock('@/infrastructure/repositories/PrismaParticipantRepository', () => ({
  PrismaParticipantRepository: class {
    getParticipantByUserAndPoll = mocks.participant;
  },
}));
vi.mock('@/application/user/getUserModerationAccess', () => ({
  getUserModerationAccess: mocks.moderation,
}));
vi.mock('@/infrastructure/repositories/PrismaUserModerationRepository', () => ({
  PrismaUserModerationRepository: class {},
}));
const { GET } = await import('../route');
const invoke = () =>
  GET(new Request('http://localhost/api/polls/poll1/seal/voter-check'), {
    params: Promise.resolve({ pollId: 'poll1' }),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.user.mockResolvedValue({
    id: 'user1',
    isConfirmed: () => true,
    privacySetupCompleted: true,
  });
  mocks.moderation.mockResolvedValue(success('allowed'));
  const seal = PollSeal.fromRecord(fixture.record);
  const reader = new SealExports(
    {
      findByPollId: async () => success(seal),
      findPublishedByPollId: async () =>
        success({
          manifest: seal.manifestBytes,
          rootDigest: seal.rootDigest,
          anchor: null,
        }),
    },
    {
      forViewer: async () =>
        success({
          results: false,
          names: false,
          signers: false,
          attachments: false,
        }),
    }
  );
  mocks.myProof.mockImplementation(reader.myProof.bind(reader));
  mocks.proof.mockImplementation(reader.proof.bind(reader));
});

it('returns only the signed-in voter’s proof and stored code without caching it', async () => {
  const storedCode = JSON.parse(fixture.receipt).receiptSecret;
  mocks.participant.mockResolvedValue(
    success({ receiptSecret: storedCode, secretMetadata: 'hidden' })
  );
  const response = await invoke();
  expect(response.status).toBe(200);
  expect(response.headers.get('cache-control')).toMatch(/private.*no-store/);
  const text = await response.text();
  const body = JSON.parse(text);
  expect(body).toEqual({ bundle: expect.any(String), proof: null, storedCode });
  const bundle = JSON.parse(body.bundle);
  expect(bundle.poll).toBeUndefined();
  expect(
    bundle.leaves.every(
      (l: { preimage: { userId: string } }) => l.preimage.userId === 'user1'
    )
  ).toBe(true);

  for (const value of ['Café', 'Second?', 'receiptSecret', 'user2', 'hidden']) {
    expect(text).not.toContain(value);
  }
});

it('rejects nonvoters before looking up any stored code', async () => {
  mocks.user.mockResolvedValue({
    id: 'nonvoter',
    isConfirmed: () => true,
    privacySetupCompleted: true,
  });
  const response = await invoke();
  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'seal.errors.notAVoter' });
  expect(mocks.participant).not.toHaveBeenCalled();
});

it.each([
  [null, '/login', 401],
  [{ isConfirmed: (): boolean => false }, '/confirm-phone', 403],
  [
    { isConfirmed: (): boolean => true, privacySetupCompleted: false },
    '/privacy-setup',
    403,
  ],
  [
    {
      id: 'user1',
      isConfirmed: (): boolean => true,
      privacySetupCompleted: true,
    },
    '/blocked',
    403,
  ],
])(
  'enforces the setup and moderation gates before reading evidence',
  async (user, next, status) => {
    mocks.user.mockResolvedValue(user);
    mocks.moderation.mockResolvedValue(success('blocked'));
    const response = await invoke();
    expect(response.status).toBe(status);
    expect(await response.json()).toMatchObject({ next });
    expect(mocks.myProof).not.toHaveBeenCalled();
  }
);
