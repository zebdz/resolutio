/** Cancels only a pending membership request using the domain lifecycle policy.
 * Reads status through a typed store; the repository removes the allowed link row. */
import { OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { MembershipStore } from './MembershipStore';
import {
  MembershipReference,
  requirePendingMembership,
} from '../../domain/organization/MembershipPolicy';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { CancelJoinRequestInput } from './CancelJoinRequestSchema';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';

export interface CancelJoinRequestDependencies {
  memberships: Pick<MembershipStore, 'findStatus'>;
  organizationRepository: OrganizationRepository;
}

export class CancelJoinRequestUseCase {
  constructor(private deps: CancelJoinRequestDependencies) {}

  async execute(
    input: CancelJoinRequestInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedUserId = UserId.safeParse(input.userId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const command = {
      ...input,
      organizationId: parsedOrganizationId.data,
      userId: parsedUserId.data,
    };

    const { organizationId, userId } = command;

    // The domain permits cancellation only for an existing pending request.
    const status = await this.deps.memberships.findStatus(
      MembershipReference.parse({ organizationId, userId })
    );

    if (!status.success) {
      return status;
    }

    const pending = requirePendingMembership(status.value);

    if (!pending.success) {
      return pending;
    }

    // Delete the OrganizationUser row
    await this.deps.organizationRepository.removeUserFromOrganization(
      userId,
      organizationId
    );

    return success(undefined);
  }
}
