/** Snapshot-fact decoding cannot turn an unknown stored distribution into an
 * ownership lock; the adapter rejects corruption before domain policy runs. */
import { describe, expect, it } from 'vitest';
import { PrismaPropertyLockRepository } from '../PrismaPropertyLockRepository';
import { OrganizationId } from '../../../domain/shared/EntityIds';
describe('PrismaPropertyLockRepository', () => {
  it('rejects an unknown persisted distribution type', async () => {
    const repository = new PrismaPropertyLockRepository({
      poll: {
        findMany: async () => [{ distributionType: 'UNKNOWN', properties: [] }],
      },
    } as any);
    expect(
      await repository.findSnapshotFactsForOrg(OrganizationId.parse('org-1'))
    ).toEqual({ success: false, error: 'common.errors.unexpected' });
  });
});
