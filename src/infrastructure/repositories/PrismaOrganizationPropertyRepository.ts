import { PrismaClient } from '@/generated/prisma/client';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationProperty } from '../../domain/organization/OrganizationProperty';
import {
  OrganizationPropertyRepository,
  PropertiesByOrg,
} from '../../domain/organization/OrganizationPropertyRepository';
import { SizeUnitValue } from '../../domain/organization/SizeUnit';

export class PrismaOrganizationPropertyRepository implements OrganizationPropertyRepository {
  constructor(private prisma: PrismaClient) {}

  async findByOrganizationTree(
    rootOrgId: string
  ): Promise<Result<PropertiesByOrg[], string>> {
    try {
      // Descendants walk — mirrors PrismaOrganizationRepository.getDescendantIds.
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

      const groupsMap = new Map<string, OrganizationProperty[]>();

      for (const orgId of allOrgIds) {
        groupsMap.set(orgId, []);
      }

      for (const row of properties) {
        const list = groupsMap.get(row.organizationId) ?? [];
        list.push(this.toEntity(row));
        groupsMap.set(row.organizationId, list);
      }

      return success(
        allOrgIds.map((orgId) => ({
          orgId,
          orgName: orgNameById.get(orgId) ?? '',
          properties: groupsMap.get(orgId) ?? [],
        }))
      );
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findByOrganization(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>> {
    try {
      const rows = await this.prisma.organizationProperty.findMany({
        where: { organizationId, archivedAt: null },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findAllByOrganizationIncludingArchived(
    organizationId: string
  ): Promise<Result<OrganizationProperty[], string>> {
    try {
      const rows = await this.prisma.organizationProperty.findMany({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
      });

      return success(rows.map((r) => this.toEntity(r)));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async findById(
    id: string
  ): Promise<Result<OrganizationProperty | null, string>> {
    try {
      const row = await this.prisma.organizationProperty.findUnique({
        where: { id },
      });

      return success(row ? this.toEntity(row) : null);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async countNonArchived(
    organizationId: string
  ): Promise<Result<number, string>> {
    try {
      const n = await this.prisma.organizationProperty.count({
        where: { organizationId, archivedAt: null },
      });

      return success(n);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async hasAnyNonArchived(
    organizationIds: string[]
  ): Promise<Result<Map<string, boolean>, string>> {
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
      const map = new Map<string, boolean>();

      for (const id of organizationIds) {
        map.set(id, false);
      }

      for (const r of rows) {
        map.set(r.organizationId, r._count._all > 0);
      }

      return success(map);
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async save(
    property: OrganizationProperty
  ): Promise<Result<OrganizationProperty, string>> {
    try {
      const created = await this.prisma.organizationProperty.create({
        data: {
          organizationId: property.organizationId,
          name: property.name,
          address: property.address,
          sizeUnit: property.sizeUnit,
        },
      });

      return success(this.toEntity(created));
    } catch (e) {
      return failure((e as Error).message);
    }
  }

  async update(property: OrganizationProperty): Promise<Result<void, string>> {
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
      return failure((e as Error).message);
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
      sizeUnit: row.sizeUnit as SizeUnitValue,
      createdAt: row.createdAt,
      archivedAt: row.archivedAt,
    });
  }
}
