import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyAsset } from '../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../domain/organization/PropertyAssetOwnership';
import {
  PropertyAssetRepository,
  AssetOwnershipRow,
  AllOwnershipRow,
  AllOwnershipFilter,
  OwnershipRowToInsert,
} from '../../domain/organization/PropertyAssetRepository';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

// The DB enforces a partial unique index on
//   (asset_id, user_id) WHERE effective_until IS NULL AND user_id IS NOT NULL
// (see migration 20260427142323). When that fires, Prisma raises P2002.
// Prisma 7 with the driver adapter (PrismaPg) places the offending index
// name in `meta.driverAdapterError.cause.originalMessage` — NOT in
// `meta.target` (that older path is empty for partial indexes). The
// dbConstraint integration test confirms this surface. Translate the raw
// error into our domain code so callers don't surface "P2002" to the UI.
const ACTIVE_USER_OWNERSHIP_INDEX =
  'property_asset_ownerships_active_user_unique';

function isDuplicateActiveOwnerError(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) {
    return false;
  }

  if (e.code !== 'P2002') {
    return false;
  }

  const adapter = (
    e.meta as
      | { driverAdapterError?: { cause?: { originalMessage?: string } } }
      | undefined
  )?.driverAdapterError;
  const originalMessage = adapter?.cause?.originalMessage ?? '';

  if (originalMessage.includes(ACTIVE_USER_OWNERSHIP_INDEX)) {
    return true;
  }

  // Fallback: `meta.target` was the legacy shape. Keep the check in case
  // a future Prisma version restores it.
  const target = (e.meta as { target?: string | string[] } | undefined)?.target;

  if (Array.isArray(target)) {
    return target.includes(ACTIVE_USER_OWNERSHIP_INDEX);
  }

  return target === ACTIVE_USER_OWNERSHIP_INDEX;
}

export class PrismaPropertyAssetRepository implements PropertyAssetRepository {
  constructor(private prisma: PrismaClient) {}

  async findCurrentOwnershipByOrg(
    organizationId: string,
    propertyIds: string[]
  ): Promise<Result<AssetOwnershipRow[], string>> {
    try {
      const where: Prisma.PropertyAssetOwnershipWhereInput = {
        effectiveUntil: null,
        asset: {
          archivedAt: null,
          property: {
            archivedAt: null,
            organizationId,
            ...(propertyIds.length > 0 ? { id: { in: propertyIds } } : {}),
          },
        },
      };
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where,
        include: { asset: true },
      });

      return success(
        rows.map((r) => ({
          asset: PropertyAsset.reconstitute({
            id: r.asset.id,
            propertyId: r.asset.propertyId,
            name: r.asset.name,
            size: Number(r.asset.size),
            createdAt: r.asset.createdAt,
            archivedAt: r.asset.archivedAt,
          }),
          ownership: PropertyAssetOwnership.reconstitute({
            id: r.id,
            assetId: r.assetId,
            userId: r.userId,
            externalOwnerLabel: r.externalOwnerLabel,
            share: Number(r.share),
            effectiveFrom: r.effectiveFrom,
            effectiveUntil: r.effectiveUntil,
            createdAt: r.createdAt,
          }),
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findCurrentOwnership(
    organizationIds: string[],
    propertyIds: string[]
  ): Promise<Result<AssetOwnershipRow[], string>> {
    try {
      if (organizationIds.length === 0) {
        return success([]);
      }

      const where: Prisma.PropertyAssetOwnershipWhereInput = {
        effectiveUntil: null,
        asset: {
          archivedAt: null,
          property: {
            archivedAt: null,
            organizationId: { in: organizationIds },
            ...(propertyIds.length > 0 ? { id: { in: propertyIds } } : {}),
          },
        },
      };
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where,
        include: { asset: true },
      });

      return success(
        rows.map((r) => ({
          asset: PropertyAsset.reconstitute({
            id: r.asset.id,
            propertyId: r.asset.propertyId,
            name: r.asset.name,
            size: Number(r.asset.size),
            createdAt: r.asset.createdAt,
            archivedAt: r.asset.archivedAt,
          }),
          ownership: PropertyAssetOwnership.reconstitute({
            id: r.id,
            assetId: r.assetId,
            userId: r.userId,
            externalOwnerLabel: r.externalOwnerLabel,
            share: Number(r.share),
            effectiveFrom: r.effectiveFrom,
            effectiveUntil: r.effectiveUntil,
            createdAt: r.createdAt,
          }),
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findAssetsInScope(
    organizationIds: string[],
    propertyIds: string[]
  ): Promise<
    Result<Array<{ id: string; propertyId: string; size: number }>, string>
  > {
    try {
      if (organizationIds.length === 0) {
        return success([]);
      }

      const rows = await this.prisma.propertyAsset.findMany({
        where: {
          archivedAt: null,
          property: {
            archivedAt: null,
            organizationId: { in: organizationIds },
            ...(propertyIds.length > 0 ? { id: { in: propertyIds } } : {}),
          },
        },
        select: { id: true, propertyId: true, size: true },
      });

      return success(
        rows.map((r) => ({
          id: r.id,
          propertyId: r.propertyId,
          size: Number(r.size),
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async orgHasOwnershipData(
    organizationId: string
  ): Promise<Result<boolean, string>> {
    try {
      const allOrgIds = await this.getOrgTreeIds(organizationId);
      const row = await this.prisma.propertyAssetOwnership.findFirst({
        where: {
          effectiveUntil: null,
          asset: {
            archivedAt: null,
            property: {
              archivedAt: null,
              organizationId: { in: allOrgIds },
            },
          },
        },
        select: { id: true },
      });

      return success(row !== null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async hasUserOwnership(
    organizationId: string,
    userId: string
  ): Promise<Result<boolean, string>> {
    try {
      const allOrgIds = await this.getOrgTreeIds(organizationId);
      const row = await this.prisma.propertyAssetOwnership.findFirst({
        where: {
          effectiveUntil: null,
          userId,
          asset: {
            archivedAt: null,
            property: {
              archivedAt: null,
              organizationId: { in: allOrgIds },
            },
          },
        },
        select: { id: true },
      });

      return success(row !== null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  // Cross-tree poll scope: a poll on rootOrgId may include descendants'
  // properties. Mirrors PrismaOrganizationPropertyRepository.findByOrganizationTree
  // and PrismaOrganizationRepository.getDescendantIds. Skips archived orgs.
  private async getOrgTreeIds(rootOrgId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue: string[] = [rootOrgId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.organization.findMany({
        where: { parentId: currentId, archivedAt: null },
        select: { id: true },
      });

      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    return [rootOrgId, ...descendants];
  }

  async findAssetsByProperty(
    propertyId: string,
    includeArchived: boolean
  ): Promise<Result<PropertyAsset[], string>> {
    try {
      const rows = await this.prisma.propertyAsset.findMany({
        where: {
          propertyId,
          ...(includeArchived ? {} : { archivedAt: null }),
        },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.assetToEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findAssetById(
    assetId: string
  ): Promise<Result<PropertyAsset | null, string>> {
    try {
      const row = await this.prisma.propertyAsset.findUnique({
        where: { id: assetId },
      });

      return success(row ? this.assetToEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findActiveOwnershipForAsset(
    assetId: string
  ): Promise<Result<PropertyAssetOwnership[], string>> {
    try {
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where: { assetId, effectiveUntil: null },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.ownershipToEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findOwnershipById(
    ownershipId: string
  ): Promise<Result<PropertyAssetOwnership | null, string>> {
    try {
      const row = await this.prisma.propertyAssetOwnership.findUnique({
        where: { id: ownershipId },
      });

      return success(row ? this.ownershipToEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findOwnershipRows(
    filter: AllOwnershipFilter
  ): Promise<Result<AllOwnershipRow[], string>> {
    try {
      const ownerQuery = filter.ownerQuery?.trim();
      const assetQuery = filter.assetQuery?.trim();

      const where: Prisma.PropertyAssetOwnershipWhereInput = {
        asset: {
          property: { organizationId: filter.organizationId },
          ...(filter.propertyId ? { propertyId: filter.propertyId } : {}),
          ...(assetQuery
            ? { name: { contains: assetQuery, mode: 'insensitive' as const } }
            : {}),
        },
        ...(filter.activeOnly ? { effectiveUntil: null } : {}),
        ...(ownerQuery
          ? {
              // Match against user names (if linked) OR the external owner label.
              OR: [
                {
                  user: {
                    OR: [
                      {
                        firstName: {
                          contains: ownerQuery,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        lastName: {
                          contains: ownerQuery,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        middleName: {
                          contains: ownerQuery,
                          mode: 'insensitive' as const,
                        },
                      },
                      {
                        nickname: {
                          contains: ownerQuery,
                          mode: 'insensitive' as const,
                        },
                      },
                    ],
                  },
                },
                {
                  externalOwnerLabel: {
                    contains: ownerQuery,
                    mode: 'insensitive' as const,
                  },
                },
              ],
            }
          : {}),
      };
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where,
        include: {
          asset: { include: { property: true } },
          user: {
            select: {
              firstName: true,
              lastName: true,
              middleName: true,
              nickname: true,
            },
          },
        },
        orderBy: [{ effectiveFrom: 'desc' }],
      });

      return success(
        rows.map((r) => ({
          id: r.id,
          assetId: r.assetId,
          assetName: r.asset.name,
          propertyId: r.asset.propertyId,
          propertyName: r.asset.property.name,
          userId: r.userId,
          userLabel: r.user
            ? `${[r.user.lastName, r.user.firstName, r.user.middleName]
                .filter(Boolean)
                .join(' ')} (@${r.user.nickname})`
            : null,
          externalOwnerLabel: r.externalOwnerLabel,
          share: Number(r.share),
          effectiveFrom: r.effectiveFrom,
          effectiveUntil: r.effectiveUntil,
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findClaimableAssets(
    propertyId: string
  ): Promise<Result<{ id: string; name: string }[], string>> {
    try {
      // "Claimable" = non-archived asset that's either
      //   (a) placeholder-owned: has an active ownership row with user_id IS NULL
      //   (b) ownerless: has no active ownership rows at all (admin just added it)
      // Implemented as a Prisma OR — the `none` branch covers (b) since `some`
      // alone wouldn't match assets with zero rows.
      const rows = await this.prisma.propertyAsset.findMany({
        where: {
          propertyId,
          archivedAt: null,
          OR: [
            {
              ownerships: {
                some: { effectiveUntil: null, userId: null },
              },
            },
            {
              ownerships: {
                none: { effectiveUntil: null },
              },
            },
          ],
        },
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async saveAsset(
    asset: PropertyAsset
  ): Promise<Result<PropertyAsset, string>> {
    try {
      const created = await this.prisma.propertyAsset.create({
        data: {
          propertyId: asset.propertyId,
          name: asset.name,
          size: new Prisma.Decimal(asset.size.toString()),
        },
      });

      return success(this.assetToEntity(created));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async updateAsset(asset: PropertyAsset): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyAsset.update({
        where: { id: asset.id },
        data: {
          name: asset.name,
          size: new Prisma.Decimal(asset.size.toString()),
          archivedAt: asset.archivedAt,
        },
      });

      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async replaceOwners(input: {
    assetId: string;
    at: Date;
    inserts: OwnershipRowToInsert[];
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.propertyAssetOwnership.updateMany({
          where: { assetId: input.assetId, effectiveUntil: null },
          data: { effectiveUntil: input.at },
        });

        if (input.inserts.length > 0) {
          await tx.propertyAssetOwnership.createMany({
            data: input.inserts.map((r) => ({
              assetId: input.assetId,
              userId: r.userId,
              externalOwnerLabel: r.externalOwnerLabel,
              share: new Prisma.Decimal(r.share.toString()),
              effectiveFrom: input.at,
            })),
          });
        }
      });

      return success(undefined);
    } catch (e) {
      if (isDuplicateActiveOwnerError(e)) {
        return failure(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
      }

      return failure((e as Error).message);
    }
  }

  async correctOwnership(input: {
    ownershipId: string;
    newShare: number;
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyAssetOwnership.update({
        where: { id: input.ownershipId },
        data: { share: new Prisma.Decimal(input.newShare.toString()) },
      });

      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async linkOwnershipToUser(input: {
    ownershipId: string;
    userId: string;
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyAssetOwnership.update({
        where: { id: input.ownershipId },
        data: { userId: input.userId, externalOwnerLabel: null },
      });

      return success(undefined);
    } catch (e) {
      if (isDuplicateActiveOwnerError(e)) {
        return failure(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
      }

      return failure((e as Error).message);
    }
  }

  async createOwnershipForUser(input: {
    assetId: string;
    userId: string;
    share: number;
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.propertyAssetOwnership.create({
        data: {
          assetId: input.assetId,
          userId: input.userId,
          externalOwnerLabel: null,
          share: new Prisma.Decimal(input.share.toString()),
          // effectiveFrom defaults to now() in DB; effectiveUntil stays null
          // — caller is responsible for ensuring no other active rows exist.
        },
      });

      return success(undefined);
    } catch (e) {
      if (isDuplicateActiveOwnerError(e)) {
        return failure(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
      }

      return failure((e as Error).message);
    }
  }

  async mergePlaceholderIntoExistingOwner(input: {
    placeholderOwnershipId: string;
    existingOwnershipId: string;
    newShare: number;
  }): Promise<Result<void, string>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // End-date the external placeholder row first. This is an SCD-2
        // close — preserves the historical record of who used to be on
        // the slot (useful for audits when "Who is miss-c?" comes up).
        await tx.propertyAssetOwnership.update({
          where: { id: input.placeholderOwnershipId },
          data: { effectiveUntil: new Date() },
        });
        // Bump the claimant's existing row to the combined share. SCD-1
        // in-place — same pattern as `linkOwnershipToUser`. Asset total
        // stays at 1.0 because the closed placeholder's share equals the
        // delta we add here.
        await tx.propertyAssetOwnership.update({
          where: { id: input.existingOwnershipId },
          data: { share: new Prisma.Decimal(input.newShare.toString()) },
        });
      });

      return success(undefined);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  private assetToEntity(row: {
    id: string;
    propertyId: string;
    name: string;
    size: Prisma.Decimal;
    createdAt: Date;
    archivedAt: Date | null;
  }): PropertyAsset {
    return PropertyAsset.reconstitute({
      id: row.id,
      propertyId: row.propertyId,
      name: row.name,
      size: Number(row.size),
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    });
  }

  private ownershipToEntity(row: {
    id: string;
    assetId: string;
    userId: string | null;
    externalOwnerLabel: string | null;
    share: Prisma.Decimal;
    effectiveFrom: Date;
    effectiveUntil: Date | null;
    createdAt: Date;
  }): PropertyAssetOwnership {
    return PropertyAssetOwnership.reconstitute({
      id: row.id,
      assetId: row.assetId,
      userId: row.userId,
      externalOwnerLabel: row.externalOwnerLabel,
      share: Number(row.share),
      effectiveFrom: row.effectiveFrom,
      effectiveUntil: row.effectiveUntil,
      createdAt: row.createdAt,
    });
  }
}
