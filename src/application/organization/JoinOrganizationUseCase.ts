/** Authorizes a membership request, invokes the domain renewal policy and persists
 * its explicit transition through a typed store before arranging notifications. */
import { IdGenerator, Clock } from '../shared/EntityCreation';
import {
  OrganizationId,
  UserId,
  JoinTokenId,
} from '../../domain/shared/EntityIds';
import { MembershipStore } from './MembershipStore';
import {
  MembershipReference,
  requestMembership,
} from '../../domain/organization/MembershipPolicy';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { NotificationRepository } from '../../domain/notification/NotificationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinOrganizationInput } from './JoinOrganizationSchema';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { NotifyJoinRequestReceivedUseCase } from '../notification/NotifyJoinRequestReceivedUseCase';

export interface JoinOrganizationDependencies {
  clock: Clock;
  ids: IdGenerator;
  organizationRepository: OrganizationRepository;
  invitationRepository: InvitationRepository;
  notificationRepository: NotificationRepository;
  userRepository: UserRepository;
  memberships: Pick<MembershipStore, 'findStatus' | 'saveRequest'>;
}

export class JoinOrganizationUseCase {
  constructor(private deps: JoinOrganizationDependencies) {}

  async execute(
    input: JoinOrganizationInput,
    rawUserId: string
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedUserId = UserId.safeParse(rawUserId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const userId = parsedUserId.data;

    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedJoinTokenId = JoinTokenId.optional().safeParse(
      input.joinTokenId
    );

    if (!parsedJoinTokenId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      joinTokenId: parsedJoinTokenId.data,
    };

    const { organizationId } = command;

    // Check if organization exists
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // Check membership conflicts through the domain policy before other join checks.
    const reference = MembershipReference.parse({ organizationId, userId });
    const existing = await this.deps.memberships.findStatus(reference);

    if (!existing.success) {
      return existing;
    }

    const request = requestMembership(
      existing.value,
      command.joinTokenId ?? null,
      this.deps.clock.now()
    );

    if (!request.success) {
      return request;
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

    const saved = await this.deps.memberships.saveRequest(
      reference,
      request.value
    );

    if (!saved.success) {
      return saved;
    }

    // Notify admins about the new join request
    const notifyUseCase = new NotifyJoinRequestReceivedUseCase({
      ids: this.deps.ids,
      clock: this.deps.clock,
      organizationRepository: this.deps.organizationRepository,
      notificationRepository: this.deps.notificationRepository,
      userRepository: this.deps.userRepository,
    });
    await notifyUseCase
      .execute({ organizationId, requesterUserId: userId })
      .then((outcome) => {
        if (!outcome.success) {
          console.error(
            'Notification delivery failed (NotifyJoinRequestReceivedUseCase):',
            outcome.error
          );
        }
      })
      .catch((err) => {
        console.error('Failed to send join request notifications:', err);
      });

    return success(undefined);
  }
}
