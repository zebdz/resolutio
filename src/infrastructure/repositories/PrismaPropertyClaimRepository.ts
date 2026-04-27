import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  PropertyClaim,
  PropertyClaimStatus,
} from '../../domain/organization/PropertyClaim';
import { PropertyClaimAttachment } from '../../domain/organization/PropertyClaimAttachment';
import {
  PropertyClaimRepository,
  PendingClaimListRow,
  MyClaimListRow,
} from '../../domain/organization/PropertyClaimRepository';

export class PrismaPropertyClaimRepository implements PropertyClaimRepository {
  constructor(private prisma: PrismaClient) {}

  async save(claim: PropertyClaim): Promise<Result<PropertyClaim, string>> {
    try {
      const created = await this.prisma.propertyClaim.create({
        data: {
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
      return failure((e as Error).message);
    }
  }

  async saveWithOptionalAttachment(input: {
    claim: PropertyClaim;
    attachment?: { entity: PropertyClaimAttachment; bytes: Buffer };
  }): Promise<Result<PropertyClaim, string>> {
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        const claimRow = await tx.propertyClaim.create({
          data: {
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
      return failure((e as Error).message);
    }
  }

  async update(claim: PropertyClaim): Promise<Result<void, string>> {
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
      return failure((e as Error).message);
    }
  }

  async findById(id: string): Promise<Result<PropertyClaim | null, string>> {
    try {
      const row = await this.prisma.propertyClaim.findUnique({ where: { id } });

      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findPendingForAsset(
    assetId: string
  ): Promise<Result<PropertyClaim[], string>> {
    try {
      const rows = await this.prisma.propertyClaim.findMany({
        where: { assetId, status: 'PENDING' },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findLatestDecidedForUserAndAsset(
    userId: string,
    assetId: string
  ): Promise<Result<PropertyClaim | null, string>> {
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
      return failure((e as Error).message);
    }
  }

  async findPendingForOrg(
    organizationId: string
  ): Promise<Result<PendingClaimListRow[], string>> {
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
          claimantFirstName: r.user.firstName,
          claimantLastName: r.user.lastName,
          claimantMiddleName: r.user.middleName,
          assetName: r.asset.name,
          propertyId: r.asset.propertyId,
          propertyName: r.asset.property.name,
          externalOwnerLabel: r.asset.ownerships[0]?.externalOwnerLabel ?? null,
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findMyClaimsForProperty(
    userId: string,
    propertyId: string
  ): Promise<Result<MyClaimListRow[], string>> {
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
          assetName: r.asset.name,
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findPendingForAssets(
    assetIds: string[]
  ): Promise<Result<PropertyClaim[], string>> {
    try {
      if (assetIds.length === 0) {
        return success([]);
      }

      const rows = await this.prisma.propertyClaim.findMany({
        where: { assetId: { in: assetIds }, status: 'PENDING' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async getOrgAdminUserIds(
    organizationId: string
  ): Promise<Result<string[], string>> {
    try {
      const rows = await this.prisma.organizationAdminUser.findMany({
        where: { organizationId },
        select: { userId: true },
      });

      return success(rows.map((r) => r.userId));
    } catch (e) {
      return failure((e as Error).message);
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
      status: row.status as PropertyClaimStatus,
      deniedReason: row.deniedReason,
      decidedBy: row.decidedBy,
      decidedAt: row.decidedAt,
      createdAt: row.createdAt,
    });
  }
}
