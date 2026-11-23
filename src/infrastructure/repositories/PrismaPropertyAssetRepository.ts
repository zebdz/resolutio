/** Prisma adapter for property assets and ownership history. It validates ORM
 * records, persists domain-supplied identity/time, and normalizes storage failures. */
import {
  AssetId,
  PropertyId,
  OwnershipId,
  UserId,
  OrganizationId,
} from '../../domain/shared/EntityIds';
import { Instant } from '../../domain/shared/Instant';
import {
  AssetName,
  PropertyName,
  AssetSize,
  OwnershipShare,
} from '../../domain/organization/PropertyValues';
import { SizeUnit, SizeUnitValue } from '../../domain/organization/SizeUnit';
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyAsset } from '../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../domain/organization/PropertyAssetOwnership';
import {
  PropertyAssetRepository,
  PropertyAssetRepositoryError,
  AssetOwnershipRow,
  AllOwnershipRow,
  OwnershipOwnerProjection,
  AllOwnershipFilter,
  OwnershipRowToInsert,
  HoldingRow,
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
    organizationId: OrganizationId,
    propertyIds: PropertyId[]
  ): Promise<Result<AssetOwnershipRow[], PropertyAssetRepositoryError>> {
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
      return failure('common.errors.unexpected');
    }
  }

  async findCurrentOwnership(
    organizationIds: OrganizationId[],
    propertyIds: PropertyId[]
  ): Promise<Result<AssetOwnershipRow[], PropertyAssetRepositoryError>> {
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
      return failure('common.errors.unexpected');
    }
  }

  async findAssetsInScope(
    organizationIds: OrganizationId[],
    propertyIds: PropertyId[]
  ): Promise<
    Result<
      Array<{ id: AssetId; propertyId: PropertyId; size: AssetSize }>,
      PropertyAssetRepositoryError
    >
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
          id: AssetId.parse(r.id),
          propertyId: PropertyId.parse(r.propertyId),
          size: AssetSize.parse(Number(r.size)),
        }))
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findHoldingsAsOf(input: {
    organizationIds: OrganizationId[];
    propertyIds: PropertyId[];
    userIds: UserId[];
    asOf: Instant;
  }): Promise<Result<HoldingRow[], PropertyAssetRepositoryError>> {
    try {
      if (input.userIds.length === 0 || input.organizationIds.length === 0) {
        return success([]);
      }

      // SCD-2 window: the row was already in force at `asOf` and had not yet
      // been end-dated. `effectiveUntil` is exclusive, matching replaceOwners,
      // which stamps the closing row and the opening row with the same instant.
      const where: Prisma.PropertyAssetOwnershipWhereInput = {
        userId: { in: input.userIds },
        effectiveFrom: { lte: Instant.toDate(input.asOf) },
        OR: [
          { effectiveUntil: null },
          { effectiveUntil: { gt: Instant.toDate(input.asOf) } },
        ],
        asset: {
          archivedAt: null,
          property: {
            archivedAt: null,
            organizationId: { in: input.organizationIds },
            ...(input.propertyIds.length > 0
              ? { id: { in: input.propertyIds } }
              : {}),
          },
        },
      };

      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where,
        include: {
          asset: {
            include: { property: { select: { name: true, sizeUnit: true } } },
          },
        },
      });

      const holdings: HoldingRow[] = rows.map((r) => ({
        userId: UserId.parse(r.userId),
        propertyName: PropertyName.parse(r.asset.property.name),
        assetName: AssetName.parse(r.asset.name),
        size: AssetSize.parse(Number(r.asset.size)),
        sizeUnit: this.sizeUnit(r.asset.property.sizeUnit),
        share: OwnershipShare.parse(Number(r.share)),
      }));

      // Sorted here rather than in SQL: ordering across two nested to-one
      // relations is fragile in Prisma, and the row count per poll is small.
      holdings.sort(
        (a, b) =>
          a.propertyName.localeCompare(b.propertyName) ||
          a.assetName.localeCompare(b.assetName)
      );

      return success(holdings);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async orgHasOwnershipData(
    organizationId: OrganizationId
  ): Promise<Result<boolean, PropertyAssetRepositoryError>> {
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
      return failure('common.errors.unexpected');
    }
  }

  async hasUserOwnership(
    organizationId: OrganizationId,
    userId: UserId
  ): Promise<Result<boolean, PropertyAssetRepositoryError>> {
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
      return failure('common.errors.unexpected');
    }
  }

  // Cross-tree poll scope: a poll on rootOrgId may include descendants'
  // properties. Mirrors PrismaOrganizationPropertyRepository.findByOrganizationTree
  // and PrismaOrganizationRepository.getDescendantIds. Skips archived orgs.
  private async getOrgTreeIds(
    rootOrgId: OrganizationId
  ): Promise<OrganizationId[]> {
    const descendants: OrganizationId[] = [];
    const queue: OrganizationId[] = [rootOrgId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;
      const children = await this.prisma.organization.findMany({
        where: { parentId: currentId, archivedAt: null },
        select: { id: true },
      });

      for (const child of children) {
        const childId = OrganizationId.parse(child.id);
        descendants.push(childId);
        queue.push(childId);
      }
    }

    return [rootOrgId, ...descendants];
  }

  async findAssetsByProperty(
    propertyId: PropertyId,
    includeArchived: boolean
  ): Promise<Result<PropertyAsset[], PropertyAssetRepositoryError>> {
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
      return failure('common.errors.unexpected');
    }
  }

  async findAssetById(
    assetId: AssetId
  ): Promise<Result<PropertyAsset | null, PropertyAssetRepositoryError>> {
    try {
      const row = await this.prisma.propertyAsset.findUnique({
        where: { id: assetId },
      });

      return success(row ? this.assetToEntity(row) : null);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findActiveOwnershipForAsset(
    assetId: AssetId
  ): Promise<Result<PropertyAssetOwnership[], PropertyAssetRepositoryError>> {
    try {
      const rows = await this.prisma.propertyAssetOwnership.findMany({
        where: { assetId, effectiveUntil: null },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.ownershipToEntity(r)));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findOwnershipById(
    ownershipId: OwnershipId
  ): Promise<
    Result<PropertyAssetOwnership | null, PropertyAssetRepositoryError>
  > {
    try {
      const row = await this.prisma.propertyAssetOwnership.findUnique({
        where: { id: ownershipId },
      });

      return success(row ? this.ownershipToEntity(row) : null);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findOwnershipRows(
    filter: AllOwnershipFilter
  ): Promise<Result<AllOwnershipRow[], PropertyAssetRepositoryError>> {
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
        rows.map((r) => {
          const ownership = this.ownershipToEntity(r);
          const owner = ownership.owner;
          const ownerProjection: OwnershipOwnerProjection =
            owner.kind === 'user'
              ? {
                  userId: owner.userId,
                  userLabel: r.user
                    ? `${[r.user.lastName, r.user.firstName, r.user.middleName]
                        .filter(Boolean)
                        .join(' ')} (@${r.user.nickname})`
                    : null,
                  externalOwnerLabel: null,
                }
              : {
                  userId: null,
                  userLabel: null,
                  externalOwnerLabel: owner.label,
                };

          return {
            id: ownership.id,
            assetId: ownership.assetId,
            assetName: AssetName.parse(r.asset.name),
            propertyId: PropertyId.parse(r.asset.propertyId),
            propertyName: PropertyName.parse(r.asset.property.name),
            ...ownerProjection,
            share: ownership.share,
            effectiveFrom: Instant.fromDate(ownership.effectiveFrom),
            effectiveUntil:
              ownership.effectiveUntil === null
                ? null
                : Instant.fromDate(ownership.effectiveUntil),
          };
        })
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findClaimableAssets(
    propertyId: PropertyId
  ): Promise<
    Result<{ id: AssetId; name: AssetName }[], PropertyAssetRepositoryError>
  > {
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

      return success(
        rows.map((row) => ({
          id: AssetId.parse(row.id),
          name: AssetName.parse(row.name),
        }))
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async saveAsset(
    asset: PropertyAsset
  ): Promise<Result<PropertyAsset, PropertyAssetRepositoryError>> {
    try {
      const created = await this.prisma.propertyAsset.create({
        data: {
          id: asset.id,
          createdAt: asset.createdAt,
          archivedAt: asset.archivedAt,
          propertyId: asset.propertyId,
          name: asset.name,
          size: new Prisma.Decimal(asset.size.toString()),
        },
      });

      return success(this.assetToEntity(created));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async updateAsset(
    asset: PropertyAsset
  ): Promise<Result<void, PropertyAssetRepositoryError>> {
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
      return failure('common.errors.unexpected');
    }
  }

  async replaceOwners(input: {
    assetId: AssetId;
    at: Instant;
    inserts: OwnershipRowToInsert[];
  }): Promise<Result<void, PropertyAssetRepositoryError>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.propertyAssetOwnership.updateMany({
          where: { assetId: input.assetId, effectiveUntil: null },
          data: { effectiveUntil: Instant.toDate(input.at) },
        });

        if (input.inserts.length > 0) {
          await tx.propertyAssetOwnership.createMany({
            data: input.inserts.map((r) => ({
              id: r.id,
              assetId: input.assetId,
              userId: r.owner.kind === 'user' ? r.owner.userId : null,
              externalOwnerLabel:
                r.owner.kind === 'external' ? r.owner.label : null,
              share: new Prisma.Decimal(r.share.toString()),
              effectiveFrom: Instant.toDate(input.at),
              createdAt: Instant.toDate(r.createdAt),
            })),
          });
        }
      });

      return success(undefined);
    } catch (e) {
      if (isDuplicateActiveOwnerError(e)) {
        return failure(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
      }

      return failure('common.errors.unexpected');
    }
  }

  async correctOwnership(input: {
    ownershipId: OwnershipId;
    newShare: OwnershipShare;
  }): Promise<Result<void, PropertyAssetRepositoryError>> {
    try {
      await this.prisma.propertyAssetOwnership.update({
        where: { id: input.ownershipId },
        data: { share: new Prisma.Decimal(input.newShare.toString()) },
      });

      return success(undefined);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async linkOwnershipToUser(input: {
    ownershipId: OwnershipId;
    userId: UserId;
  }): Promise<Result<void, PropertyAssetRepositoryError>> {
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

      return failure('common.errors.unexpected');
    }
  }

  async createOwnershipForUser(input: {
    ownershipId: OwnershipId;
    at: Instant;
    assetId: AssetId;
    userId: UserId;
    share: OwnershipShare;
  }): Promise<Result<void, PropertyAssetRepositoryError>> {
    try {
      await this.prisma.propertyAssetOwnership.create({
        data: {
          id: input.ownershipId,
          assetId: input.assetId,
          userId: input.userId,
          externalOwnerLabel: null,
          share: new Prisma.Decimal(input.share.toString()),
          // Caller supplies creation time and ensures no other active rows exist.
          effectiveFrom: Instant.toDate(input.at),
          createdAt: Instant.toDate(input.at),
        },
      });

      return success(undefined);
    } catch (e) {
      if (isDuplicateActiveOwnerError(e)) {
        return failure(OrganizationDomainCodes.OWNERSHIP_DUPLICATE_OWNER);
      }

      return failure('common.errors.unexpected');
    }
  }

  async mergePlaceholderIntoExistingOwner(input: {
    at: Instant;
    placeholderOwnershipId: OwnershipId;
    existingOwnershipId: OwnershipId;
    newShare: OwnershipShare;
  }): Promise<Result<void, PropertyAssetRepositoryError>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // End-date the external placeholder row first. This is an SCD-2
        // close — preserves the historical record of who used to be on
        // the slot (useful for audits when "Who is miss-c?" comes up).
        await tx.propertyAssetOwnership.update({
          where: { id: input.placeholderOwnershipId },
          data: { effectiveUntil: Instant.toDate(input.at) },
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
      return failure('common.errors.unexpected');
    }
  }

  private sizeUnit(raw: string): SizeUnitValue {
    const parsed = SizeUnit.parse(raw);

    if (!parsed.success) {
      throw new Error(parsed.error);
    }

    return parsed.value;
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
