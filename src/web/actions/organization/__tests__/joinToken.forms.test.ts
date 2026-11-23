/** Direct join-link action clients cannot turn malformed limits into valid integers.
 * Mocked application ports isolate multipart validation, authorization gates and translated failures. */
import { beforeEach, expect, it, vi } from 'vitest';
import { success } from '@/domain/shared/Result';
import { UserId } from '@/domain/shared/EntityIds';

const calls = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  expire: vi.fn(),
  reactivate: vi.fn(),
  join: vi.fn(),
  user: vi.fn(),
  rate: vi.fn(),
}));
vi.mock('@/application/organization/CreateJoinTokenUseCase', () => ({
  CreateJoinTokenUseCase: class {
    execute = calls.create;
  },
}));
vi.mock('@/application/organization/UpdateJoinTokenMaxUsesUseCase', () => ({
  UpdateJoinTokenMaxUsesUseCase: class {
    execute = calls.update;
  },
}));
vi.mock('@/application/organization/ExpireJoinTokenUseCase', () => ({
  ExpireJoinTokenUseCase: class {
    execute = calls.expire;
  },
}));
vi.mock('@/application/organization/ReactivateJoinTokenUseCase', () => ({
  ReactivateJoinTokenUseCase: class {
    execute = calls.reactivate;
  },
}));
vi.mock('@/application/organization/UseJoinTokenUseCase', () => ({
  UseJoinTokenUseCase: class {
    execute = calls.join;
  },
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaOrganizationRepository: class {},
  PrismaUserRepository: class {},
  PrismaJoinTokenRepository: class {},
  PrismaInvitationRepository: class {},
  PrismaNotificationRepository: class {},
}));
vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: {
    getInstance: () => ({ containsProfanity: () => false }),
  },
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: calls.user }));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: calls.rate }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
const {
  createJoinTokenAction,
  updateJoinTokenMaxUsesAction,
  expireJoinTokenAction,
  reactivateJoinTokenAction,
  joinViaTokenAction,
} = await import('../joinToken');

function form() {
  const value = new FormData();
  value.set('organizationId', 'org');
  value.set('description', 'Lobby');
  value.set('tokenId', 'link');
  value.set('token', 'abc234defg');

  return value;
}

beforeEach(() => {
  vi.clearAllMocks();
  calls.user.mockResolvedValue({ id: UserId.parse('admin') });
  calls.rate.mockResolvedValue(null);
  calls.create.mockResolvedValue(success({ id: 'link', token: 'abc234defg' }));
  calls.update.mockResolvedValue(success(undefined));
  calls.expire.mockResolvedValue(success(undefined));
  calls.reactivate.mockResolvedValue(success(undefined));
  calls.join.mockResolvedValue(success({ organizationId: 'org' }));
});

it.each(['2.5', '2junk'])(
  'rejects malformed limit %s in create and update',
  async (limit) => {
    const input = form();
    input.set('maxUses', limit);

    for (const action of [
      createJoinTokenAction,
      updateJoinTokenMaxUsesAction,
    ]) {
      expect(await action(input)).toMatchObject({
        success: false,
        error: 'validationFailed',
        fieldErrors: { maxUses: ['joinToken.maxUsesInvalid'] },
      });
    }

    expect(calls.create).not.toHaveBeenCalled();
    expect(calls.update).not.toHaveBeenCalled();
  }
);

it.each([undefined, '', '7'])(
  'preserves unlimited and finite limits: %j',
  async (limit) => {
    const input = form();

    if (limit !== undefined) {
      input.set('maxUses', limit);
    }

    expect((await createJoinTokenAction(input)).success).toBe(true);
    expect((await updateJoinTokenMaxUsesAction(input)).success).toBe(true);
    const expected = limit ? 7 : null;
    expect(calls.create).toHaveBeenCalledWith(
      expect.objectContaining({ maxUses: expected }),
      'admin'
    );
    expect(calls.update).toHaveBeenCalledWith(
      expect.objectContaining({ maxUses: expected }),
      'admin'
    );
  }
);

it.each([
  ['expire', expireJoinTokenAction, 'tokenId'],
  ['reactivate', reactivateJoinTokenAction, 'tokenId'],
  ['join', joinViaTokenAction, 'token'],
] as const)(
  '%s rejects an uploaded file in its token field',
  async (_name, action, field) => {
    const input = form();
    input.set(field, new Blob(['abc234defg']), 'token.txt');
    expect(await action(input)).toEqual({
      success: false,
      error: 'validationFailed',
    });
    expect(calls.expire).not.toHaveBeenCalled();
    expect(calls.reactivate).not.toHaveBeenCalled();
    expect(calls.join).not.toHaveBeenCalled();
  }
);

it('rejects an uploaded limit with the localized domain code', async () => {
  const input = form();
  input.set('maxUses', new Blob(['7']), 'limit.txt');

  for (const action of [createJoinTokenAction, updateJoinTokenMaxUsesAction]) {
    expect(await action(input)).toMatchObject({
      success: false,
      fieldErrors: { maxUses: ['joinToken.maxUsesInvalid'] },
    });
  }
});
