import { PrismaClient } from '@/generated/prisma/client';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinOrganizationInput } from './JoinOrganizationSchema';
import { OrganizationErrors } from './OrganizationErrors';
import { NotifyJoinRequestReceivedUseCase } from '../notification/NotifyJoinRequestReceivedUseCase';

export interface JoinOrganizationDependencies {
  organizationRepository: OrganizationRepository;
  invitationRepository: InvitationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
  prisma: PrismaClient;
}

export class JoinOrganizationUseCase {
  constructor(private deps: JoinOrganizationDependencies) {}

  async execute(
    input: JoinOrganizationInput,
    userId: string
  ): Promise<Result<void, string>> {
    const { organizationId } = input;

    // Check if organization exists
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check if user is already a member or has a pending request
    const existingMembership =
      await this.deps.prisma.organizationUser.findUnique({
        where: {
          organizationId_userId: {
            organizationId,
            userId,
          },
        },
      });

    if (existingMembership) {
      if (existingMembership.status === 'accepted') {
        return failure(OrganizationErrors.ALREADY_MEMBER);
      }

      if (existingMembership.status === 'pending') {
        return failure(OrganizationErrors.PENDING_REQUEST);
      }
    }

    // Check if user has a pending member invite for this org
    const pendingInvite =
      await this.deps.invitationRepository.findPendingMemberInvite(
        organizationId,
        userId
      );

    if (pendingInvite) {
      return failure(OrganizationErrors.PENDING_INVITE);
    }

    // Check hierarchy constraints - block if pending request anywhere in hierarchy tree
    // (unless multi-membership is allowed for this tree)
    const allowsMulti =
      await this.deps.organizationRepository.getRootAllowMultiTreeMembership(
        organizationId
      );

    if (!allowsMulti) {
      const hierarchyIds =
        await this.deps.organizationRepository.getFullTreeOrgIds(
          organizationId
        );

      const pendingOrgs =
        await this.deps.organizationRepository.findPendingRequestsByUserId(
          userId
        );

      for (const pendingOrg of pendingOrgs) {
        if (hierarchyIds.includes(pendingOrg.id)) {
          return failure(OrganizationErrors.PENDING_HIERARCHY_REQUEST);
        }
      }
    }

    if (existingMembership && existingMembership.status === 'rejected') {
      // Re-request: reset existing record back to pending
      await this.deps.prisma.organizationUser.update({
        where: {
          organizationId_userId: { organizationId, userId },
        },
        data: {
          status: 'pending',
          rejectedAt: null,
          rejectedByUserId: null,
          rejectionReason: null,
          joinTokenId: input.joinTokenId ?? null,
        },
      });
    } else {
      // New request: create membership with pending status
      await this.deps.prisma.organizationUser.create({
        data: {
          organizationId,
          userId,
          status: 'pending',
          joinTokenId: input.joinTokenId ?? null,
        },
      });
    }

    // Notify admins about the new join request
    const notifyUseCase = new NotifyJoinRequestReceivedUseCase({
      organizationRepository: this.deps.organizationRepository,
      notificationRepository: this.deps.notificationRepository,
      userRepository: this.deps.userRepository,
    });
    await notifyUseCase
      .execute({ organizationId, requesterUserId: userId })
      .catch((err) => {
        console.error('Failed to send join request notifications:', err);
      });

    return success(undefined);
  }
}
