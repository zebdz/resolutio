/** Prisma property adapter validates persisted values and keeps application-
 * supplied identity/time stable through storage. Storage failures stay opaque. */
import { PropertyCount } from '@/domain/organization/PropertyValues';
import { OrganizationName } from '../../domain/organization/OrganizationValues';
import { OrganizationId, PropertyId } from '../../domain/shared/EntityIds';
import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationProperty } from '../../domain/organization/OrganizationProperty';
import {
  OrganizationPropertyRepository,
  PropertyRepositoryError,
  PropertiesByOrg,
} from '../../domain/organization/OrganizationPropertyRepository';

export class PrismaOrganizationPropertyRepository implements OrganizationPropertyRepository {
  constructor(private prisma: PrismaClient) {}

  async findByOrganizationTree(
    rootOrgId: OrganizationId
  ): Promise<Result<PropertiesByOrg[], PropertyRepositoryError>> {
    try {
      // Descendants walk — mirrors PrismaOrganizationRepository.getDescendantIds.
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

      const allOrgIds = [rootOrgId, ...descendants];

      const orgs = await this.prisma.organization.findMany({
        where: { id: { in: allOrgIds } },
        select: { id: true, name: true },
      });
      const orgNameById = new Map(orgs.map((o) => [o.id, o.name]));

      const properties = await this.prisma.organizationProperty.findMany({
        where: { organizationId: { in: allOrgIds }, archivedAt: null },
        orderBy: [{ organizationId: 'asc' }, { createdAt: 'asc' }],
      });

      const groupsMap = new Map<OrganizationId, OrganizationProperty[]>();

      for (const orgId of allOrgIds) {
        groupsMap.set(orgId, []);
      }

      for (const row of properties) {
        const list =
          groupsMap.get(OrganizationId.parse(row.organizationId)) ?? [];
        list.push(this.toEntity(row));
        groupsMap.set(OrganizationId.parse(row.organizationId), list);
      }

      return success(
        allOrgIds.map((orgId) => ({
          orgId,
          orgName: OrganizationName.parse(orgNameById.get(orgId)),
          properties: groupsMap.get(orgId) ?? [],
        }))
      );
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findByOrganization(
    organizationId: OrganizationId
  ): Promise<Result<OrganizationProperty[], PropertyRepositoryError>> {
    try {
      const rows = await this.prisma.organizationProperty.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findAllByOrganizationIncludingArchived(
    organizationId: OrganizationId
  ): Promise<Result<OrganizationProperty[], PropertyRepositoryError>> {
    try {
      const rows = await this.prisma.organizationProperty.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async findById(
    id: PropertyId
  ): Promise<Result<OrganizationProperty | null, PropertyRepositoryError>> {
    try {
      const row = await this.prisma.organizationProperty.findUnique({
        where: { id },
      });

      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async countNonArchived(
    organizationId: OrganizationId
  ): Promise<Result<PropertyCount, PropertyRepositoryError>> {
    try {
      const n = await this.prisma.organizationProperty.count({
        where: { organizationId, archivedAt: null },
      });

      return success(PropertyCount.parse(n));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async hasAnyNonArchived(
    organizationIds: OrganizationId[]
  ): Promise<Result<Map<OrganizationId, boolean>, PropertyRepositoryError>> {
    try {
      if (organizationIds.length === 0) {
        return success(new Map());
      }

      const rows = await this.prisma.organizationProperty.groupBy({
        by: ['organizationId'],
        where: {
          organizationId: { in: organizationIds },
          archivedAt: null,
        },
        _count: { _all: true },
      });
      const map = new Map<OrganizationId, boolean>();

      for (const id of organizationIds) {
        map.set(id, false);
      }

      for (const r of rows) {
        map.set(OrganizationId.parse(r.organizationId), r._count._all > 0);
      }

      return success(map);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async save(
    property: OrganizationProperty
  ): Promise<Result<OrganizationProperty, PropertyRepositoryError>> {
    try {
      const created = await this.prisma.organizationProperty.create({
        data: {
          id: property.id,
          createdAt: property.createdAt,
          archivedAt: property.archivedAt,
          organizationId: property.organizationId,
          name: property.name,
          address: property.address,
          sizeUnit: property.sizeUnit,
        },
      });

      return success(this.toEntity(created));
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  async update(
    property: OrganizationProperty
  ): Promise<Result<void, PropertyRepositoryError>> {
    try {
      await this.prisma.$transaction(async (tx) => {
        // Cascade archive/unarchive across non-archived assets:
        // if property transitions to archived, we let the caller handle asset archive
        // (see ArchivePropertyUseCase). Here we simply write the property row.
        await tx.organizationProperty.update({
          where: { id: property.id },
          data: {
            name: property.name,
            address: property.address,
            sizeUnit: property.sizeUnit,
            archivedAt: property.archivedAt,
          },
        });
      });

      return success(undefined);
    } catch (e) {
      return failure('common.errors.unexpected');
    }
  }

  private toEntity(row: {
    id: string;
    organizationId: string;
    name: string;
    address: string | null;
    sizeUnit: string;
    createdAt: Date;
    archivedAt: Date | null;
  }): OrganizationProperty {
    return OrganizationProperty.reconstitute({
      id: row.id,
      organizationId: row.organizationId,
      name: row.name,
      address: row.address,
      sizeUnit: row.sizeUnit,
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    });
  }
}
