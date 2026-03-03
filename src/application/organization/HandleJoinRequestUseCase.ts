import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { HandleJoinRequestInput } from './HandleJoinRequestSchema';
import { OrganizationErrors } from './OrganizationErrors';
import { NotifyJoinRequestAcceptedUseCase } from '../notification/NotifyJoinRequestAcceptedUseCase';
import { NotifyJoinRequestRejectedUseCase } from '../notification/NotifyJoinRequestRejectedUseCase';

export interface HandleJoinRequestDependencies {
  prisma: PrismaClient;
  organizationRepository: OrganizationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
}

export class HandleJoinRequestUseCase {
  constructor(private deps: HandleJoinRequestDependencies) {}

  async execute(input: HandleJoinRequestInput): Promise<Result<void, string>> {
    const {
      organizationId,
      requesterId,
      adminId,
      action,
      rejectionReason,
      silent,
    } = input;

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
      const hierarchyOrgIds =
        await this.deps.organizationRepository.getFullTreeOrgIds(
          organizationId
        );

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

    // 5. Notify requester (fire-and-forget, skip for autoJoin)
    if (!silent) {
      const notifyDeps = {
        organizationRepository: this.deps.organizationRepository,
        notificationRepository: this.deps.notificationRepository,
      };

      if (action === 'accept') {
        new NotifyJoinRequestAcceptedUseCase(notifyDeps)
          .execute({ organizationId, requesterUserId: requesterId })
          .catch((err) =>
            console.error('Failed to notify join request accepted:', err)
          );
      } else {
        new NotifyJoinRequestRejectedUseCase(notifyDeps)
          .execute({
            organizationId,
            requesterUserId: requesterId,
            rejectionReason: rejectionReason || '',
          })
          .catch((err) =>
            console.error('Failed to notify join request rejected:', err)
          );
      }
    }

    return success(undefined);
  }
}
