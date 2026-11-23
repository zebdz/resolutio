/** Application creation supplies generated link entropy, identity and time to
 * the aggregate, then persists those exact values through its repository port. */
import { describe, expect, it } from 'vitest';
import { CreateJoinTokenUseCase } from '../CreateJoinTokenUseCase';
import { JoinToken } from '../../../domain/organization/JoinToken';
import { JoinTokenValue } from '../../../domain/organization/JoinTokenValues';
import { Instant } from '../../../domain/shared/Instant';

describe('CreateJoinToken inputs', () => {
  it('retains generated identity, entropy and clock time', async () => {
    const now = Instant.parse('2026-01-01T00:00:00.000Z');
    const useCase = new CreateJoinTokenUseCase({
      ids: {
        generate: <Id extends string>(schema: { parse(raw: unknown): Id }) =>
          schema.parse('created-token'),
      },
      clock: { now: () => now },
      tokens: { generate: () => JoinTokenValue.parse('abc234defg') },
      organizationRepository: {
        findById: async () => ({ isArchived: () => false }),
      } as any,
      joinTokenRepository: { save: async (token: JoinToken) => token } as any,
      userRepository: { isSuperAdmin: async () => true } as any,
    });
    const result = await useCase.execute(
      { organizationId: 'org', description: 'Lobby' },
      'actor'
    );
    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value.id).toBe('created-token');
    expect(result.value.token).toBe('abc234defg');
    expect(result.value.createdAt.toISOString()).toBe(now);
  });
});
