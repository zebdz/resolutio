import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';

export interface OrgTreeMember {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  // Comma-separated list of org names this user belongs to within the tree.
  orgNames: string[];
}

export interface SearchOrgTreeMembersInput {
  rootOrganizationId: string;
  actorUserId: string;
  query: string;
  // Hard ceiling on returned matches; UI typically wants ~20.
  limit: number;
}

export interface SearchOrgTreeMembersDependencies {
  prisma: PrismaClient;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

// Tree-aware member search for picker UIs (EditOwnersModal, etc.). Authorized
// for admins of the root org and superadmins only — same gate as the rest of
// the cross-tree poll-creation flow. Search matches first/last/middle/nickname
// (substring, case-insensitive). Empty query returns the most recent N members
// across the tree so the dropdown isn't empty on first open.
export class SearchOrgTreeMembersUseCase {
  constructor(private deps: SearchOrgTreeMembersDependencies) {}

  async execute(
    input: SearchOrgTreeMembersInput
  ): Promise<Result<OrgTreeMember[], string>> {
    const root = await this.deps.organizationRepository.findById(
      input.rootOrganizationId
    );

    if (!root) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const isSuperAdmin = await this.deps.userRepository.isSuperAdmin(
      input.actorUserId
    );

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        input.actorUserId,
        input.rootOrganizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    const descendantIds =
      await this.deps.organizationRepository.getDescendantIds(
        input.rootOrganizationId
      );
    const treeOrgIds = [input.rootOrganizationId, ...descendantIds];

    const trimmed = input.query.trim();
    const userFilter = trimmed
      ? {
          user: {
            OR: [
              {
                firstName: { contains: trimmed, mode: 'insensitive' as const },
              },
              { lastName: { contains: trimmed, mode: 'insensitive' as const } },
              {
                middleName: { contains: trimmed, mode: 'insensitive' as const },
              },
              { nickname: { contains: trimmed, mode: 'insensitive' as const } },
            ],
          },
        }
      : {};

    // Pull membership rows then dedup by userId — a multi-tree-membership user
    // appears once per org but should only appear once in the picker.
    // Pull more rows than `limit` to leave room for dedup before truncating.
    const fetchCap = Math.max(input.limit * 4, 80);
    const rows = await this.deps.prisma.organizationUser.findMany({
      where: {
        organizationId: { in: treeOrgIds },
        status: 'accepted',
        ...userFilter,
      },
      include: {
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            middleName: true,
            nickname: true,
          },
        },
        organization: { select: { name: true } },
      },
      orderBy: { acceptedAt: 'desc' },
      take: fetchCap,
    });

    const byUser = new Map<string, OrgTreeMember>();

    for (const row of rows) {
      const existing = byUser.get(row.user.id);

      if (existing) {
        existing.orgNames.push(row.organization.name);
        continue;
      }

      byUser.set(row.user.id, {
        id: row.user.id,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        middleName: row.user.middleName,
        nickname: row.user.nickname,
        orgNames: [row.organization.name],
      });
    }

    return success(Array.from(byUser.values()).slice(0, input.limit));
  }
}
