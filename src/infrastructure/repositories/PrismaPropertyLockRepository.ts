import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { PropertyLockRepository } from '../../domain/organization/PropertyLockRepository';
import { LockSnapshotFact } from '../../domain/organization/PropertyLockService';

export class PrismaPropertyLockRepository implements PropertyLockRepository {
  constructor(private prisma: PrismaClient) {}

  async findSnapshotFactsForOrg(
    organizationId: string
  ): Promise<Result<LockSnapshotFact[], string>> {
    try {
      // A snapshot fact exists for every poll in the org that has at least one
      // row in poll_eligible_members (i.e. TakeSnapshot has run for it).
      const polls = await this.prisma.poll.findMany({
        where: {
          organizationId,
          eligibleMembers: { some: {} },
        },
        select: {
          distributionType: true,
          properties: { select: { propertyId: true } },
        },
      });

      return success(
        polls.map((p) => ({
          distributionType: p.distributionType,
          explicitScopePropertyIds: p.properties.map((x) => x.propertyId),
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findSnapshotFactsForProperty(
    propertyId: string
  ): Promise<Result<LockSnapshotFact[], string>> {
    try {
      const property = await this.prisma.organizationProperty.findUnique({
        where: { id: propertyId },
        select: { organizationId: true },
      });

      if (!property) {
        return success([]);
      }

      // Walk ancestor chain: a parent-org poll with empty scope implicitly
      // locks this property if that poll is ownership-based.
      const ancestorIds: string[] = [];
      let currentId: string | null = property.organizationId;

      while (currentId) {
        ancestorIds.push(currentId);
        const parentRow: { parentId: string | null } | null =
          await this.prisma.organization.findUnique({
            where: { id: currentId },
            select: { parentId: true },
          });
        currentId = parentRow?.parentId ?? null;
      }

      const polls = await this.prisma.poll.findMany({
        where: {
          eligibleMembers: { some: {} },
          OR: [
            // Poll's organization is in this property's org or any ancestor,
            // and the poll has either empty scope or explicitly scopes this property.
            {
              organizationId: { in: ancestorIds },
              properties: { none: {} },
            },
            { properties: { some: { propertyId } } },
          ],
        },
        select: {
          distributionType: true,
          properties: { select: { propertyId: true } },
        },
      });

      return success(
        polls.map((p) => ({
          distributionType: p.distributionType,
          explicitScopePropertyIds: p.properties.map((x) => x.propertyId),
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }
}
