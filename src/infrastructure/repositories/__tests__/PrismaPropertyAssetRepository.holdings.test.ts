// Point-in-time ownership lookup behind the named protocol's participant
// register. The whole point of the "as of" window is that a flat sold after
// the vote must not change what the protocol says about that vote, so the
// filter shape is pinned here rather than left to a passing integration run.

import { describe, it, expect, vi } from 'vitest';
import { PrismaPropertyAssetRepository } from '../PrismaPropertyAssetRepository';

function makeRepo(rows: any[]) {
  const findMany = vi.fn().mockResolvedValue(rows);
  const prisma = { propertyAssetOwnership: { findMany } } as any;

  return { repo: new PrismaPropertyAssetRepository(prisma), findMany };
}

const asOf = new Date('2026-03-01T00:00:00Z');

function row(overrides: {
  userId?: string;
  assetName: string;
  size: string;
  share: string;
  propertyName?: string;
}) {
  return {
    userId: overrides.userId ?? 'user-1',
    share: overrides.share,
    asset: {
      name: overrides.assetName,
      size: overrides.size,
      property: {
        name: overrides.propertyName ?? 'Дом Гвардейский 13',
        sizeUnit: 'SQUARE_METERS',
      },
    },
  };
}

describe('PrismaPropertyAssetRepository.findHoldingsAsOf', () => {
  it('short-circuits with no users', async () => {
    const { repo, findMany } = makeRepo([]);

    const result = await repo.findHoldingsAsOf({
      organizationIds: ['org-1'],
      propertyIds: [],
      userIds: [],
      asOf,
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value).toEqual([]);
    }

    expect(findMany).not.toHaveBeenCalled();
  });

  it('short-circuits with no organizations', async () => {
    const { repo, findMany } = makeRepo([]);

    const result = await repo.findHoldingsAsOf({
      organizationIds: [],
      propertyIds: [],
      userIds: ['user-1'],
      asOf,
    });

    expect(result.success).toBe(true);
    expect(findMany).not.toHaveBeenCalled();
  });

  it('filters on the as-of window and excludes archived rows', async () => {
    const { repo, findMany } = makeRepo([]);

    await repo.findHoldingsAsOf({
      organizationIds: ['org-1', 'org-2'],
      propertyIds: ['prop-1'],
      userIds: ['user-1'],
      asOf,
    });

    const where = findMany.mock.calls[0][0].where;

    expect(where.userId).toEqual({ in: ['user-1'] });
    expect(where.effectiveFrom).toEqual({ lte: asOf });
    // effectiveUntil is exclusive: replaceOwners stamps the closing row and
    // the opening row with the same instant, so `gt` picks exactly one.
    expect(where.OR).toEqual([
      { effectiveUntil: null },
      { effectiveUntil: { gt: asOf } },
    ]);
    expect(where.asset.archivedAt).toBeNull();
    expect(where.asset.property.archivedAt).toBeNull();
    expect(where.asset.property.organizationId).toEqual({
      in: ['org-1', 'org-2'],
    });
    expect(where.asset.property.id).toEqual({ in: ['prop-1'] });
  });

  it('omits the property filter when the poll has no scope', async () => {
    const { repo, findMany } = makeRepo([]);

    await repo.findHoldingsAsOf({
      organizationIds: ['org-1'],
      propertyIds: [],
      userIds: ['user-1'],
      asOf,
    });

    expect(findMany.mock.calls[0][0].where.asset.property.id).toBeUndefined();
  });

  it('maps decimals to numbers and sorts by property then asset', async () => {
    const { repo } = makeRepo([
      row({ assetName: 'кв. 738', size: '64', share: '0.5' }),
      row({ assetName: 'кв. 12', size: '18', share: '1' }),
      row({
        assetName: 'кв. 1',
        size: '30',
        share: '1',
        propertyName: 'Дом Апрельский 2',
      }),
    ]);

    const result = await repo.findHoldingsAsOf({
      organizationIds: ['org-1'],
      propertyIds: [],
      userIds: ['user-1'],
      asOf,
    });

    expect(result.success).toBe(true);

    if (!result.success) {
      return;
    }

    expect(result.value).toEqual([
      {
        userId: 'user-1',
        propertyName: 'Дом Апрельский 2',
        assetName: 'кв. 1',
        size: 30,
        sizeUnit: 'SQUARE_METERS',
        share: 1,
      },
      {
        userId: 'user-1',
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 12',
        size: 18,
        sizeUnit: 'SQUARE_METERS',
        share: 1,
      },
      {
        userId: 'user-1',
        propertyName: 'Дом Гвардейский 13',
        assetName: 'кв. 738',
        size: 64,
        sizeUnit: 'SQUARE_METERS',
        share: 0.5,
      },
    ]);
  });

  it('surfaces a query failure as a failed Result', async () => {
    const findMany = vi.fn().mockRejectedValue(new Error('connection lost'));
    const repo = new PrismaPropertyAssetRepository({
      propertyAssetOwnership: { findMany },
    } as any);

    const result = await repo.findHoldingsAsOf({
      organizationIds: ['org-1'],
      propertyIds: [],
      userIds: ['user-1'],
      asOf,
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe('connection lost');
    }
  });
});
