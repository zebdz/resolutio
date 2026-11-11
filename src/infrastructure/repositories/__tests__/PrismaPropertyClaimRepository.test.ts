/** Claim persistence round trips keep creation identity/time and reject impossible
 * decision columns before an invalid lifecycle enters the application. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaPropertyClaimRepository } from '../PrismaPropertyClaimRepository';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import {
  PropertyClaimId,
  OrganizationId,
} from '../../../domain/shared/EntityIds';
const row = {
  id: 'claim-created',
  organizationId: 'org-1',
  userId: 'user-1',
  assetId: 'asset-1',
  status: 'PENDING',
  deniedReason: null,
  decidedBy: null,
  decidedAt: null,
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};
describe('PrismaPropertyClaimRepository', () => {
  it.each(['save', 'atomic'] as const)(
    'preserves caller identity and time through the %s write',
    async (mode) => {
      const create = vi.fn(async ({ data }: any) => ({
        ...row,
        id: 'db-default',
        createdAt: new Date('2025-01-01T00:00:00.000Z'),
        ...data,
      }));
      const prisma = {
        propertyClaim: { create },
        $transaction: async (work: (tx: unknown) => Promise<unknown>) =>
          work(prisma),
      };
      const repository = new PrismaPropertyClaimRepository(prisma as any);
      const claim = PropertyClaim.reconstitute(row);
      const result =
        mode === 'save'
          ? await repository.save(claim)
          : await repository.saveWithOptionalAttachment({ claim });
      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.id).toBe(row.id);
        expect(result.value.createdAt).toEqual(row.createdAt);
      }
    }
  );
  it('normalizes impossible persisted decision state to a stable failure', async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValue({ ...row, status: 'APPROVED' });
    expect(
      await new PrismaPropertyClaimRepository({
        propertyClaim: { findUnique },
      } as any).findById(PropertyClaimId.parse(row.id))
    ).toEqual({ success: false, error: 'common.errors.unexpected' });
  });
  it('rejects invalid claimant names instead of weakening the user value contract', async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        ...row,
        user: { firstName: '', lastName: 'Smith', middleName: null },
        asset: {
          name: 'Unit',
          propertyId: 'property-1',
          property: { name: 'Building' },
          ownerships: [],
        },
      },
    ]);
    const repository = new PrismaPropertyClaimRepository({
      propertyClaim: { findMany },
    } as any);
    expect(
      await repository.findPendingForOrg(OrganizationId.parse('org-1'))
    ).toEqual({ success: false, error: 'common.errors.unexpected' });
  });
});
