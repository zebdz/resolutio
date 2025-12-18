import { PrismaClient } from '@/generated/prisma/client';
import { Organization } from '../../domain/organization/Organization';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';

export class PrismaOrganizationRepository implements OrganizationRepository {
  constructor(private prisma: PrismaClient) {}

  async save(organization: Organization): Promise<Organization> {
    const data = organization.toJSON();

    const created = await this.prisma.organization.create({
      data: {
        name: data.name,
        description: data.description,
        parentId: data.parentId,
        createdById: data.createdById,
        createdAt: data.createdAt,
        archivedAt: data.archivedAt,
      },
    });

    // Also create the admin relationship
    await this.prisma.organizationAdminUser.create({
      data: {
        organizationId: created.id,
        userId: data.createdById,
      },
    });

    return Organization.reconstitute({
      id: created.id,
      name: created.name,
      description: created.description,
      parentId: created.parentId,
      createdById: created.createdById,
      createdAt: created.createdAt,
      archivedAt: created.archivedAt,
    });
  }

  async findById(id: string): Promise<Organization | null> {
    const org = await this.prisma.organization.findUnique({
      where: { id },
    });

    if (!org) {
      return null;
    }

    return Organization.reconstitute({
      id: org.id,
      name: org.name,
      description: org.description,
      parentId: org.parentId,
      createdById: org.createdById,
      createdAt: org.createdAt,
      archivedAt: org.archivedAt,
    });
  }

  async findByName(name: string): Promise<Organization | null> {
    const org = await this.prisma.organization.findUnique({
      where: { name },
    });

    if (!org) {
      return null;
    }

    return Organization.reconstitute({
      id: org.id,
      name: org.name,
      description: org.description,
      parentId: org.parentId,
      createdById: org.createdById,
      createdAt: org.createdAt,
      archivedAt: org.archivedAt,
    });
  }

  async findByCreatorId(creatorId: string): Promise<Organization[]> {
    const orgs = await this.prisma.organization.findMany({
      where: { createdById: creatorId },
    });

    return orgs.map((org) =>
      Organization.reconstitute({
        id: org.id,
        name: org.name,
        description: org.description,
        parentId: org.parentId,
        createdById: org.createdById,
        createdAt: org.createdAt,
        archivedAt: org.archivedAt,
      })
    );
  }

  async findByParentId(parentId: string): Promise<Organization[]> {
    const orgs = await this.prisma.organization.findMany({
      where: { parentId },
    });

    return orgs.map((org) =>
      Organization.reconstitute({
        id: org.id,
        name: org.name,
        description: org.description,
        parentId: org.parentId,
        createdById: org.createdById,
        createdAt: org.createdAt,
        archivedAt: org.archivedAt,
      })
    );
  }

  async getAncestorIds(organizationId: string): Promise<string[]> {
    const ancestors: string[] = [];
    let currentId: string | null = organizationId;

    while (currentId) {
      const org: { parentId: string | null } | null =
        await this.prisma.organization.findUnique({
          where: { id: currentId },
          select: { parentId: true },
        });

      if (!org || !org.parentId) {
        break;
      }

      ancestors.push(org.parentId);
      currentId = org.parentId;
    }

    return ancestors;
  }

  async getDescendantIds(organizationId: string): Promise<string[]> {
    const descendants: string[] = [];
    const queue: string[] = [organizationId];

    while (queue.length > 0) {
      const currentId = queue.shift()!;

      const children = await this.prisma.organization.findMany({
        where: { parentId: currentId },
        select: { id: true },
      });

      for (const child of children) {
        descendants.push(child.id);
        queue.push(child.id);
      }
    }

    return descendants;
  }

  async isUserMember(userId: string, organizationId: string): Promise<boolean> {
    const membership = await this.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
        status: 'accepted',
      },
    });

    return !!membership;
  }

  async isUserAdmin(userId: string, organizationId: string): Promise<boolean> {
    const admin = await this.prisma.organizationAdminUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId,
        },
      },
    });

    return !!admin;
  }

  async findMembershipsByUserId(userId: string): Promise<Organization[]> {
    const memberships = await this.prisma.organizationUser.findMany({
      where: {
        userId,
        status: 'accepted',
      },
      include: {
        organization: true,
      },
    });

    return memberships.map((m) =>
      Organization.reconstitute({
        id: m.organization.id,
        name: m.organization.name,
        description: m.organization.description,
        parentId: m.organization.parentId,
        createdById: m.organization.createdById,
        createdAt: m.organization.createdAt,
        archivedAt: m.organization.archivedAt,
      })
    );
  }

  async findAdminOrganizationsByUserId(
    userId: string
  ): Promise<Organization[]> {
    const adminRoles = await this.prisma.organizationAdminUser.findMany({
      where: {
        userId,
      },
      include: {
        organization: true,
      },
    });

    return adminRoles.map((admin) =>
      Organization.reconstitute({
        id: admin.organization.id,
        name: admin.organization.name,
        description: admin.organization.description,
        parentId: admin.organization.parentId,
        createdById: admin.organization.createdById,
        createdAt: admin.organization.createdAt,
        archivedAt: admin.organization.archivedAt,
      })
    );
  }

  async update(organization: Organization): Promise<Organization> {
    const data = organization.toJSON();

    const updated = await this.prisma.organization.update({
      where: { id: data.id },
      data: {
        name: data.name,
        description: data.description,
        archivedAt: data.archivedAt,
      },
    });

    return Organization.reconstitute({
      id: updated.id,
      name: updated.name,
      description: updated.description,
      parentId: updated.parentId,
      createdById: updated.createdById,
      createdAt: updated.createdAt,
      archivedAt: updated.archivedAt,
    });
  }

  async findAllWithStats(excludeUserMemberships?: string): Promise<
    Array<{
      organization: Organization;
      memberCount: number;
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>
  > {
    const whereClause: any = {
      archivedAt: null,
    };

    // If userId provided, exclude organizations where user is member or has pending request
    if (excludeUserMemberships) {
      whereClause.NOT = {
        members: {
          some: {
            userId: excludeUserMemberships,
            status: {
              in: ['pending', 'accepted'],
            },
          },
        },
      };
    }

    const organizations = await this.prisma.organization.findMany({
      where: whereClause,
      include: {
        _count: {
          select: {
            members: {
              where: {
                status: 'accepted',
              },
            },
          },
        },
        admins: {
          take: 1,
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return organizations.map((org) => ({
      organization: Organization.reconstitute({
        id: org.id,
        name: org.name,
        description: org.description,
        parentId: org.parentId,
        createdById: org.createdById,
        createdAt: org.createdAt,
        archivedAt: org.archivedAt,
      }),
      memberCount: org._count.members,
      firstAdmin:
        org.admins.length > 0
          ? {
              id: org.admins[0].user.id,
              firstName: org.admins[0].user.firstName,
              lastName: org.admins[0].user.lastName,
            }
          : null,
    }));
  }
}
