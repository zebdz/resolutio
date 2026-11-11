/** Organization directory adapter isolates ORM queries and decodes public read models.
 * Invalid stored data becomes an explicit failure; private profile fields stay in storage. */
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import {
  OrganizationDirectory,
  DirectoryPerson,
  DirectoryQuery,
  DirectoryTreeQuery,
  DirectoryTreeMember,
  OrganizationPendingQuery,
  DirectoryPagination,
  AdminPendingQuery,
  DirectoryUserOrganizations,
} from '../../application/organization/OrganizationDirectory';
import { Organization } from '../../domain/organization/Organization';
import {
  MembershipStatus,
  MembershipRejectionReason,
} from '../../domain/organization/MembershipPolicy';
import { FirstName, LastName, MiddleName } from '../../domain/user/UserValues';
import { Nickname } from '../../domain/user/Nickname';
import { Instant } from '../../domain/shared/Instant';
import { ResultCount } from '../../domain/shared/Pagination';
import {
  MemberCount,
  OrganizationName,
} from '../../domain/organization/OrganizationValues';
import { BoardId, OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { success, failure } from '../../domain/shared/Result';

const nameSelection = {
  id: true,
  firstName: true,
  lastName: true,
  middleName: true,
} as const;
const profileSelection = { ...nameSelection, nickname: true } as const;

function person(row: {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
}): DirectoryPerson {
  return {
    id: UserId.parse(row.id),
    firstName: FirstName.parse(row.firstName),
    lastName: LastName.parse(row.lastName),
    middleName: MiddleName.nullable().parse(row.middleName),
  };
}

function userFilter(query: string | undefined) {
  return query
    ? {
        user: {
          OR: [
            { firstName: { contains: query, mode: 'insensitive' as const } },
            { lastName: { contains: query, mode: 'insensitive' as const } },
            { middleName: { contains: query, mode: 'insensitive' as const } },
            { nickname: { contains: query, mode: 'insensitive' as const } },
          ],
        },
      }
    : {};
}

function pageWindow(
  pagination: DirectoryPagination | undefined
): Pick<Prisma.OrganizationUserFindManyArgs, 'skip' | 'take'> {
  return pagination
    ? {
        skip: (pagination.page - 1) * pagination.pageSize,
        take: pagination.pageSize,
      }
    : {};
}

export class PrismaOrganizationDirectory implements OrganizationDirectory {
  constructor(private readonly prisma: PrismaClient) {}

  async userOrganizations(
    userId: UserId
  ): ReturnType<OrganizationDirectory['userOrganizations']> {
    try {
      const rows = await this.prisma.organizationUser.findMany({
        where: { userId },
        include: {
          organization: {
            include: { parent: { select: { id: true, name: true } } },
          },
          rejectedBy: { select: nameSelection },
        },
        orderBy: { createdAt: 'desc' },
      });
      const result: DirectoryUserOrganizations = {
        member: [],
        pending: [],
        rejected: [],
      };

      for (const row of rows) {
        const organization = Organization.reconstitute({
          id: row.organization.id,
          name: row.organization.name,
          description: row.organization.description,
          parentId: row.organization.parentId,
          createdById: row.organization.createdById,
          createdAt: row.organization.createdAt,
          archivedAt: row.organization.archivedAt,
          allowMultiTreeMembership:
            row.organization.allowMultiTreeMembership ?? null,
        });
        const parentOrg = row.organization.parent
          ? {
              id: OrganizationId.parse(row.organization.parent.id),
              name: OrganizationName.parse(row.organization.parent.name),
            }
          : null;
        const common = { organization, parentOrg };
        const status = MembershipStatus.parse(row.status);

        switch (status) {
          case 'accepted':
            // Preserve the existing display omission for legacy rows without a join time.
            if (row.acceptedAt !== null) {
              result.member.push({
                ...common,
                joinedAt: Instant.fromDate(row.acceptedAt),
              });
            }

            break;
          case 'pending':
            result.pending.push({
              ...common,
              requestedAt: Instant.fromDate(row.createdAt),
            });
            break;
          case 'rejected':
            // Deleted historical actors and missing decision times were omitted from this view.
            if (row.rejectedAt !== null && row.rejectedBy !== null) {
              result.rejected.push({
                ...common,
                rejectedAt: Instant.fromDate(row.rejectedAt),
                rejectionReason: MembershipRejectionReason.nullable().parse(
                  row.rejectionReason
                ),
                rejectedBy: person(row.rejectedBy),
              });
            }

            break;

          default: {
            const exhaustive: never = status;
            throw new Error(`Invalid membership status: ${exhaustive}`);
          }
        }
      }

      return success(result);
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async pendingForAdmin(
    input: AdminPendingQuery
  ): ReturnType<OrganizationDirectory['pendingForAdmin']> {
    try {
      // Resolve the exact admin roles before reading any organizations' requests.
      const roles = await this.prisma.organizationAdminUser.findMany({
        where: { userId: input.adminId },
        select: { organizationId: true },
      });

      if (roles.length === 0) {
        return success({ requests: [], totalCount: ResultCount.parse(0) });
      }

      const organizationIds = roles.map((role) =>
        OrganizationId.parse(role.organizationId)
      );
      const where = {
        organizationId: { in: organizationIds },
        status: 'pending' as const,
      };
      const count = await this.prisma.organizationUser.count({ where });
      const rows = await this.prisma.organizationUser.findMany({
        where,
        include: {
          user: { select: nameSelection },
          organization: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'asc' },
        ...pageWindow(input.pagination),
      });

      return success({
        requests: rows.map((row) => ({
          organizationId: OrganizationId.parse(row.organizationId),
          organizationName: OrganizationName.parse(row.organization.name),
          requester: person(row.user),
          requestedAt: Instant.fromDate(row.createdAt),
        })),
        totalCount: ResultCount.parse(count),
      });
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async pendingForOrganization(
    input: OrganizationPendingQuery
  ): ReturnType<OrganizationDirectory['pendingForOrganization']> {
    try {
      const where = {
        organizationId: input.organizationId,
        status: 'pending' as const,
      };
      const count = await this.prisma.organizationUser.count({ where });
      const rows = await this.prisma.organizationUser.findMany({
        where,
        include: { user: { select: nameSelection } },
        orderBy: { createdAt: 'asc' },
        ...pageWindow(input.pagination),
      });

      return success({
        requests: rows.map((row) => ({
          requester: person(row.user),
          requestedAt: Instant.fromDate(row.createdAt),
        })),
        totalCount: ResultCount.parse(count),
      });
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async treeMembers(
    input: DirectoryTreeQuery
  ): ReturnType<OrganizationDirectory['treeMembers']> {
    try {
      // Pull membership rows then dedup by userId — a multi-tree-membership user
      // appears once per org but should only appear once in the picker.
      // Pull more rows than `limit` to leave room for dedup before truncating.
      const fetchCap = Math.max(input.limit * 4, 80);
      const rows = await this.prisma.organizationUser.findMany({
        where: {
          organizationId: { in: [...input.organizationIds] },
          status: 'accepted',
          ...userFilter(input.query.trim()),
        },
        include: {
          user: { select: profileSelection },
          organization: { select: { name: true } },
        },
        orderBy: { acceptedAt: 'desc' },
        take: fetchCap,
      });
      const byUser = new Map<UserId, DirectoryTreeMember>();

      for (const row of rows) {
        const member = person(row.user);
        const organizationName = OrganizationName.parse(row.organization.name);
        const existing = byUser.get(member.id);

        if (existing) {
          existing.orgNames.push(organizationName);
          continue;
        }

        byUser.set(member.id, {
          ...member,
          nickname: Nickname.create(row.user.nickname),
          orgNames: [organizationName],
        });
      }

      return success(Array.from(byUser.values()).slice(0, input.limit));
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async boardMembers(
    boardId: BoardId
  ): ReturnType<OrganizationDirectory['boardMembers']> {
    try {
      const rows = await this.prisma.boardUser.findMany({
        where: { boardId, removedAt: null },
        include: { user: { select: nameSelection } },
      });

      return success(rows.map((row) => person(row.user)));
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async firstAdmin(
    organizationId: OrganizationId
  ): ReturnType<OrganizationDirectory['firstAdmin']> {
    try {
      const row = await this.prisma.organizationAdminUser.findFirst({
        where: { organizationId },
        orderBy: { createdAt: 'asc' },
        include: { user: { select: nameSelection } },
      });

      return success(row === null ? null : person(row.user));
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async members(
    input: DirectoryQuery
  ): ReturnType<OrganizationDirectory['members']> {
    try {
      const where = {
        organizationId: input.organizationId,
        status: 'accepted' as const,
        ...userFilter(input.query),
      };
      const [rows, count] = await Promise.all([
        this.prisma.organizationUser.findMany({
          where,
          include: { user: { select: profileSelection } },
          orderBy: { acceptedAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.prisma.organizationUser.count({ where }),
      ]);

      return success({
        members: rows.map((row) => ({
          ...person(row.user),
          nickname: Nickname.create(row.user.nickname),
          joinedAt:
            row.acceptedAt === null ? null : Instant.fromDate(row.acceptedAt),
        })),
        totalCount: ResultCount.parse(count),
      });
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async admins(
    input: DirectoryQuery
  ): ReturnType<OrganizationDirectory['admins']> {
    try {
      const where = {
        organizationId: input.organizationId,
        ...userFilter(input.query),
      };
      const [rows, count] = await Promise.all([
        this.prisma.organizationAdminUser.findMany({
          where,
          include: { user: { select: profileSelection } },
          orderBy: { createdAt: 'desc' },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        this.prisma.organizationAdminUser.count({ where }),
      ]);

      return success({
        admins: rows.map((row) => ({
          ...person(row.user),
          nickname: Nickname.create(row.user.nickname),
          createdAt: Instant.fromDate(row.createdAt),
        })),
        totalCount: ResultCount.parse(count),
      });
    } catch {
      return failure('common.errors.unexpected');
    }
  }

  async countAcceptedMembers(
    organizationId: OrganizationId
  ): ReturnType<OrganizationDirectory['countAcceptedMembers']> {
    try {
      const count = await this.prisma.organizationUser.count({
        where: { organizationId, status: 'accepted' },
      });

      return success(MemberCount.parse(count));
    } catch {
      return failure('common.errors.unexpected');
    }
  }
}
