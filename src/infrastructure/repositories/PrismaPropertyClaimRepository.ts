/** Claim adapter validates stored lifecycle columns and preserves supplied
 * identity/time for ordinary and atomic claim-plus-attachment writes. */
import { FirstName, LastName, MiddleName } from '../../domain/user/UserValues';
import {
  OrganizationId,
  PropertyId,
  PropertyClaimId,
  AssetId,
  UserId,
} from '../../domain/shared/EntityIds';
import {
  AssetName,
  PropertyName,
  ExternalOwnerLabel,
} from '../../domain/organization/PropertyValues';
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyClaim } from '../../domain/organization/PropertyClaim';
import { PropertyClaimAttachment } from '../../domain/organization/PropertyClaimAttachment';
import {
  PropertyClaimRepository,
  PropertyClaimRepositoryError,
  PendingClaimListRow,
  MyClaimListRow,
} from '../../domain/organization/PropertyClaimRepository';

export class PrismaPropertyClaimRepository implements PropertyClaimRepository {
  constructor(private prisma: PrismaClient) {}

  async save(
    claim: PropertyClaim
  ): Promise<Result<PropertyClaim, PropertyClaimRepositoryError>> {
    try {
      const created = await this.prisma.propertyClaim.create({
        data: {
          id: claim.id,
          createdAt: claim.createdAt,
          organizationId: claim.organizationId,
          userId: claim.userId,
          assetId: claim.assetId,
          status: claim.status,
          deniedReason: claim.deniedReason,
          decidedBy: claim.decidedBy,
          decidedAt: claim.decidedAt,
        },
      });

      return success(this.toEntity(created));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async saveWithOptionalAttachment(input: {
    claim: PropertyClaim;
    attachment?: { entity: PropertyClaimAttachment; bytes: Buffer };
  }): Promise<Result<PropertyClaim, PropertyClaimRepositoryError>> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const claimRow = await tx.propertyClaim.create({
          data: {
            id: input.claim.id,
            createdAt: input.claim.createdAt,
            organizationId: input.claim.organizationId,
            userId: input.claim.userId,
            assetId: input.claim.assetId,
            status: input.claim.status,
            deniedReason: input.claim.deniedReason,
            decidedBy: input.claim.decidedBy,
            decidedAt: input.claim.decidedAt,
          },
        });

        if (input.attachment) {
          // Copy bytes into a fresh ArrayBuffer so the strict
          // Uint8Array<ArrayBuffer> type Prisma requires is satisfied
          // (Node Buffers may sit on a SharedArrayBuffer).
          const ab = new ArrayBuffer(input.attachment.bytes.byteLength);
          new Uint8Array(ab).set(input.attachment.bytes);
          await tx.propertyClaimAttachment.create({
            data: {
              id: input.attachment.entity.id,
              createdAt: input.attachment.entity.createdAt,
              claimId: claimRow.id,
              fileName: input.attachment.entity.fileName,
              mimeType: input.attachment.entity.mimeType,
              sizeBytes: input.attachment.entity.sizeBytes,
              bytes: new Uint8Array(ab),
            },
          });
        }

        return claimRow;
      });

      return success(this.toEntity(created));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async update(
    claim: PropertyClaim
  ): Promise<Result<void, PropertyClaimRepositoryError>> {
    try {
      await this.prisma.propertyClaim.update({
        where: { id: claim.id },
        data: {
          status: claim.status,
          deniedReason: claim.deniedReason,
          decidedBy: claim.decidedBy,
          decidedAt: claim.decidedAt,
        },
      });

      return success(undefined);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findById(
    id: PropertyClaimId
  ): Promise<Result<PropertyClaim | null, PropertyClaimRepositoryError>> {
    try {
      const row = await this.prisma.propertyClaim.findUnique({ where: { id } });

      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findPendingForAsset(
    assetId: AssetId
  ): Promise<Result<PropertyClaim[], PropertyClaimRepositoryError>> {
    try {
      const rows = await this.prisma.propertyClaim.findMany({
        where: { assetId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findLatestDecidedForUserAndAsset(
    userId: UserId,
    assetId: AssetId
  ): Promise<Result<PropertyClaim | null, PropertyClaimRepositoryError>> {
    try {
      const row = await this.prisma.propertyClaim.findFirst({
        where: {
          userId,
          assetId,
          status: { in: ['APPROVED', 'DENIED'] },
        },
        orderBy: { decidedAt: 'desc' },
      });

      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findPendingForOrg(
    organizationId: OrganizationId
  ): Promise<Result<PendingClaimListRow[], PropertyClaimRepositoryError>> {
    try {
      const rows = await this.prisma.propertyClaim.findMany({
        where: { organizationId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
        include: {
          user: true,
          asset: {
            include: {
              property: true,
              ownerships: {
                where: { effectiveUntil: null, userId: null },
                select: { externalOwnerLabel: true },
              },
            },
          },
        },
      });

      return success(
        rows.map((r) => ({
          claim: this.toEntity(r),
          claimantFirstName: FirstName.parse(r.user.firstName),
          claimantLastName: LastName.parse(r.user.lastName),
          claimantMiddleName:
            r.user.middleName === null
              ? null
              : MiddleName.parse(r.user.middleName),
          assetName: AssetName.parse(r.asset.name),
          propertyId: PropertyId.parse(r.asset.propertyId),
          propertyName: PropertyName.parse(r.asset.property.name),
          externalOwnerLabel:
            r.asset.ownerships.length > 0
              ? ExternalOwnerLabel.parse(
                  r.asset.ownerships[0].externalOwnerLabel
                )
              : null,
        }))
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findMyClaimsForProperty(
    userId: UserId,
    propertyId: PropertyId
  ): Promise<Result<MyClaimListRow[], PropertyClaimRepositoryError>> {
    try {
      const rows = await this.prisma.propertyClaim.findMany({
        where: {
          userId,
          asset: { propertyId },
        },
        orderBy: { createdAt: 'desc' },
        include: { asset: { select: { name: true } } },
      });

      return success(
        rows.map((r) => ({
          claim: this.toEntity(r),
          assetName: AssetName.parse(r.asset.name),
        }))
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findPendingForAssets(
    assetIds: AssetId[]
  ): Promise<Result<PropertyClaim[], PropertyClaimRepositoryError>> {
    try {
      if (assetIds.length === 0) {
        return success([]);
      }

      const rows = await this.prisma.propertyClaim.findMany({
        where: { assetId: { in: assetIds }, status: 'PENDING' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async getOrgAdminUserIds(
    organizationId: OrganizationId
  ): Promise<Result<UserId[], PropertyClaimRepositoryError>> {
    try {
      const rows = await this.prisma.organizationAdminUser.findMany({
        where: { organizationId },
        select: { userId: true },
      });

      return success(rows.map((r) => UserId.parse(r.userId)));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  private toEntity(row: {
    id: string;
    organizationId: string;
    userId: string;
    assetId: string;
    status: string;
    deniedReason: string | null;
    decidedBy: string | null;
    decidedAt: Date | null;
    createdAt: Date;
  }): PropertyClaim {
    return PropertyClaim.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      userId: row.userId,
      assetId: row.assetId,
      status: row.status,
      deniedReason: row.deniedReason,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
    });
  }
}
