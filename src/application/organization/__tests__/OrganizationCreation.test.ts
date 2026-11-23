/** Organization creation/lifecycle boundaries preserve injected identity/time
 * rather than delegating entity identity or timestamps to persistence. */
import { describe, expect, it } from 'vitest';
import { CreateOrganizationUseCase } from '../CreateOrganizationUseCase';
import { Organization } from '../../../domain/organization/Organization';
import { Instant } from '../../../domain/shared/Instant';
const at = Instant.parse('2026-01-01T00:00:00.000Z');
describe('Organization creation inputs', () => {
  it('passes caller-generated identity and time through the creation use case', async () => {
    const useCase = new CreateOrganizationUseCase({
      ids: {
        generate: <Id extends string>(schema: { parse(raw: unknown): Id }) =>
          schema.parse('created-org'),
      },
      clock: { now: () => at },
      organizationRepository: {
        findByName: async () => null,
        save: async (org: Organization) => org,
      } as any,
      userRepository: {} as any,
      profanityChecker: {
        containsProfanity: () => false,
        findProfaneWords: () => [],
      },
    });
    const result = await useCase.execute(
      { name: 'Test Org', description: 'Description' },
      'actor'
    );
    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.organization.id).toBe('created-org');
      expect(result.value.organization.createdAt.toISOString()).toBe(at);
    }
  });
});
