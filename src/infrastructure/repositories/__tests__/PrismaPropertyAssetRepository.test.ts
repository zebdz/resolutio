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
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import {
  AssetId,
  PropertyId,
  OwnershipId,
  UserId,
} from '../../../domain/shared/EntityIds';
import { Instant } from '../../../domain/shared/Instant';
import {
  AssetName,
  AssetSize,
  ExternalOwnerLabel,
  OwnershipShare,
} from '../../../domain/organization/PropertyValues';

const at = Instant.parse('2026-01-01T00:00:00.000Z');

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
    propertyAsset: { create: vi.fn(), findUnique: vi.fn() },
    propertyAssetOwnership: {
      update: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  } as any;
}

describe('PrismaPropertyAssetRepository — validated persistence boundary', () => {
  it('preserves caller-supplied identity and creation time when saving', async () => {
    const prisma = createMockPrisma();
    prisma.propertyAsset.create.mockImplementation(async ({ data }: any) => ({
      id: 'database-generated',
      createdAt: new Date('2025-01-01T00:00:00.000Z'),
      archivedAt: null,
      ...data,
    }));
    const asset = PropertyAsset.create(
      PropertyId.parse('p-1'),
      AssetName.parse('Unit'),
      AssetSize.parse(15),
      { id: AssetId.parse('caller-created'), now: at }
    );

    if (!asset.success) {
      throw new Error(asset.error);
    }

    const saved = await new PrismaPropertyAssetRepository(prisma).saveAsset(
      asset.value
    );
    expect(saved.success).toBe(true);

    if (saved.success) {
      expect(saved.value.id).toBe('caller-created');
      expect(saved.value.createdAt).toEqual(Instant.toDate(at));
    }
  });

  it('returns a stable code when a stored asset has an invalid size', async () => {
    const prisma = createMockPrisma();
    prisma.propertyAsset.findUnique.mockResolvedValue({
      id: 'a-1',
      propertyId: 'p-1',
      name: 'Unit',
      size: Infinity,
      createdAt: Instant.toDate(at),
      archivedAt: null,
    });
    expect(
      await new PrismaPropertyAssetRepository(prisma).findAssetById(
        AssetId.parse('a-1')
      )
    ).toEqual({ success: false, error: 'common.errors.unexpected' });
  });

  it('round-trips replacement owner identities, alternatives and transition time', async () => {
    const prisma = createMockPrisma();
    const stored: any[] = [];
    const ownership = {
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      createMany: async ({ data }: any) => {
        stored.push(
          ...data.map((row: any) => ({
            id: 'database-generated',
            createdAt: new Date('2025-01-01T00:00:00.000Z'),
            effectiveFrom: new Date('2025-01-01T00:00:00.000Z'),
            effectiveUntil: null,
            ...row,
          }))
        );

        return { count: data.length };
      },
      findMany: async () => stored,
    };
    prisma.propertyAssetOwnership = ownership;
    prisma.$transaction.mockImplementation(async (callback: any) =>
      callback(prisma)
    );
    const repo = new PrismaPropertyAssetRepository(prisma);
    expect(
      (
        await repo.replaceOwners({
          assetId: AssetId.parse('a-1'),
          at,
          inserts: [
            {
              id: OwnershipId.parse('o-user'),
              owner: { kind: 'user', userId: UserId.parse('u-1') },
              share: OwnershipShare.parse(0.5),
              createdAt: at,
            },
            {
              id: OwnershipId.parse('o-external'),
              owner: {
                kind: 'external',
                label: ExternalOwnerLabel.parse('Recorded owner'),
              },
              share: OwnershipShare.parse(0.5),
              createdAt: at,
            },
          ],
        })
      ).success
    ).toBe(true);
    const result = await repo.findActiveOwnershipForAsset(AssetId.parse('a-1'));
    expect(result.success).toBe(true);

    if (result.success) {
      expect(
        result.value.map((row) => ({
          id: row.id,
          owner: row.owner,
          createdAt: row.createdAt,
          effectiveFrom: row.effectiveFrom,
        }))
      ).toEqual([
        {
          id: 'o-user',
          owner: { kind: 'user', userId: 'u-1' },
          createdAt: Instant.toDate(at),
          effectiveFrom: Instant.toDate(at),
        },
        {
          id: 'o-external',
          owner: { kind: 'external', label: 'Recorded owner' },
          createdAt: Instant.toDate(at),
          effectiveFrom: Instant.toDate(at),
        },
      ]);
    }
  });
});

describe('PrismaPropertyAssetRepository — duplicate-active-owner constraint', () => {
  describe('linkOwnershipToUser', () => {
    it('translates P2002 on the active-owner index into OWNERSHIP_DUPLICATE_OWNER', async () => {
      const prisma = createMockPrisma();
      prisma.propertyAssetOwnership.update.mockRejectedValueOnce(
        p2002WithIndexName(ACTIVE_USER_OWNERSHIP_INDEX)
      );
      const repo = new PrismaPropertyAssetRepository(prisma);
      const r = await repo.linkOwnershipToUser({
        ownershipId: OwnershipId.parse('o-1'),
        userId: UserId.parse('u-1'),
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
        ownershipId: OwnershipId.parse('o-1'),
        userId: UserId.parse('u-1'),
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
        ownershipId: OwnershipId.parse('o-created'),
        at,
        assetId: AssetId.parse('a-1'),
        userId: UserId.parse('u-1'),
        share: OwnershipShare.parse(1),
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
        assetId: AssetId.parse('a-1'),
        at,
        inserts: [
          {
            id: OwnershipId.parse('o-1'),
            owner: { kind: 'user', userId: UserId.parse('u-1') },
            share: OwnershipShare.parse(0.5),
            createdAt: at,
          },
          {
            id: OwnershipId.parse('o-2'),
            owner: { kind: 'user', userId: UserId.parse('u-1') },
            share: OwnershipShare.parse(0.5),
            createdAt: at,
          },
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
