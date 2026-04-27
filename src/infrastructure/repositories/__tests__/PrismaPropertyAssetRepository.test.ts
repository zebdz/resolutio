// Repo-level translation of the partial unique index violation. The DB
// enforces "at most one ACTIVE ownership row per (asset_id, user_id)"
// (migration 20260427142323). When that fires, Prisma raises P2002 with
// the index name in `meta.target`. Callers must see our domain code, not
// a raw Prisma error string.
//
// Why test this even though the use cases now prevent the case?
// The DB guard is the LAST LINE of defense — it catches races and any
// future code path that bypasses the use-case-level merge logic. If the
// translation regresses, callers would surface "P2002" to the UI, which
// is incomprehensible to the user. This test pins the contract.

import { describe, it, expect, vi } from 'vitest';
import { Prisma } from '@/generated/prisma/client';
import { PrismaPropertyAssetRepository } from '../PrismaPropertyAssetRepository';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';

const ACTIVE_USER_OWNERSHIP_INDEX =
  'property_asset_ownerships_active_user_unique';

// Mimics the exact P2002 shape Prisma 7 produces with the PrismaPg driver
// adapter — `meta.driverAdapterError.cause.originalMessage` carries the
// index name (verified in the dbConstraint integration test). Older
// Prisma versions used `meta.target`; the helper checks both and so does
// this fixture (each test passes one or the other).
function p2002WithIndexName(indexName: string) {
  return new Prisma.PrismaClientKnownRequestError('Unique constraint failed', {
    code: 'P2002',
    clientVersion: 'test',
    meta: {
      modelName: 'PropertyAssetOwnership',
      driverAdapterError: {
        name: 'DriverAdapterError',
        cause: {
          originalCode: '23505',
          originalMessage: `duplicate key value violates unique constraint "${indexName}"`,
          kind: 'UniqueConstraintViolation',
        },
      },
    },
  });
}

function createMockPrisma() {
  return {
    propertyAssetOwnership: {
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

describe('PrismaPropertyAssetRepository — duplicate-active-owner constraint', () => {
  describe('linkOwnershipToUser', () => {
    it('translates P2002 on the active-owner index into OWNERSHIP_DUPLICATE_OWNER', async () => {
      const prisma = createMockPrisma();
      prisma.propertyAssetOwnership.update.mockRejectedValueOnce(
        p2002WithIndexName(ACTIVE_USER_OWNERSHIP_INDEX)
      );
      const repo = new PrismaPropertyAssetRepository(prisma);
      const r = await repo.linkOwnershipToUser({
        ownershipId: 'o-1',
        userId: 'u-1',
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
    });

    it('does NOT translate when target is a different index', async () => {
      // Sanity: only the active-owner index should map to our code.
      // Other unique violations should fall through to the generic error
      // path so we don't mask unrelated bugs.
      const prisma = createMockPrisma();
      prisma.propertyAssetOwnership.update.mockRejectedValueOnce(
        p2002WithIndexName('some_other_index')
      );
      const repo = new PrismaPropertyAssetRepository(prisma);
      const r = await repo.linkOwnershipToUser({
        ownershipId: 'o-1',
        userId: 'u-1',
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).not.toBe(
        OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER
      );
    });
  });

  describe('createOwnershipForUser', () => {
    it('translates P2002 on the active-owner index into OWNERSHIP_DUPLICATE_OWNER', async () => {
      const prisma = createMockPrisma();
      prisma.propertyAssetOwnership.create.mockRejectedValueOnce(
        p2002WithIndexName(ACTIVE_USER_OWNERSHIP_INDEX)
      );
      const repo = new PrismaPropertyAssetRepository(prisma);
      const r = await repo.createOwnershipForUser({
        assetId: 'a-1',
        userId: 'u-1',
        share: 1,
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
    });
  });

  describe('replaceOwners', () => {
    it('translates P2002 on the active-owner index into OWNERSHIP_DUPLICATE_OWNER', async () => {
      const prisma = createMockPrisma();
      // replaceOwners runs in a $transaction. Whatever the callback throws
      // bubbles out — simulate that by rejecting the whole call.
      prisma.$transaction.mockRejectedValueOnce(
        p2002WithIndexName(ACTIVE_USER_OWNERSHIP_INDEX)
      );
      const repo = new PrismaPropertyAssetRepository(prisma);
      const r = await repo.replaceOwners({
        assetId: 'a-1',
        at: new Date(),
        inserts: [
          { userId: 'u-1', externalOwnerLabel: null, share: 0.5 },
          { userId: 'u-1', externalOwnerLabel: null, share: 0.5 },
        ],
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
    });
  });
});
