import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { HandleJoinRequestInput } from './HandleJoinRequestSchema';
import { OrganizationErrors } from './OrganizationErrors';

export interface HandleJoinRequestDependencies {
  prisma: PrismaClient;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class HandleJoinRequestUseCase {
  constructor(private deps: HandleJoinRequestDependencies) {}

  async execute(input: HandleJoinRequestInput): Promise<Result<void, string>> {
    const { organizationId, requesterId, adminId, action, rejectionReason } =
      input;

    // 1. Check admin permissions: superadmin or org admin
    const isSuperAdmin = await this.deps.userRepository.isSuperAdmin(adminId);

    if (!isSuperAdmin) {
      const adminRole = await this.deps.prisma.organizationAdminUser.findUnique(
        {
          where: {
            organizationId_userId: {
              organizationId,
              userId: adminId,
            },
          },
        }
      );

      if (!adminRole) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 2. Find the join request
    const request = await this.deps.prisma.organizationUser.findUnique({
      where: {
        organizationId_userId: {
          organizationId,
          userId: requesterId,
        },
      },
    });

    if (!request) {
      return failure(OrganizationErrors.REQUEST_NOT_FOUND);
    }

    // 3. Check if request is pending
    if (request.status !== 'pending') {
      return failure(OrganizationErrors.NOT_PENDING);
    }

    // 4. Update the request based on action
    const now = new Date();

    if (action === 'accept') {
      await this.deps.prisma.organizationUser.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: requesterId,
          },
        },
        data: {
          status: 'accepted',
          acceptedAt: now,
          acceptedByUserId: adminId,
        },
      });

      // Remove user from existing memberships in hierarchy orgs
      const ancestorIds =
        await this.deps.organizationRepository.getAncestorIds(organizationId);
      const descendantIds =
        await this.deps.organizationRepository.getDescendantIds(organizationId);
      const hierarchyOrgIds = [...ancestorIds, ...descendantIds];

      const userMemberships =
        await this.deps.organizationRepository.findMembershipsByUserId(
          requesterId
        );

      for (const membership of userMemberships) {
        if (hierarchyOrgIds.includes(membership.id)) {
          await this.deps.organizationRepository.removeUserFromOrganization(
            requesterId,
            membership.id
          );
        }
      }
    } else {
      await this.deps.prisma.organizationUser.update({
        where: {
          organizationId_userId: {
            organizationId,
            userId: requesterId,
          },
        },
        data: {
          status: 'rejected',
          rejectedAt: now,
          rejectedByUserId: adminId,
          rejectionReason: rejectionReason || null,
        },
      });
    }

    return success(undefined);
  }
}
