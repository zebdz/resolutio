import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors } from './InvitationErrors';

export interface GetPendingAdminInvitesDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class GetPendingAdminInvitesUseCase {
  constructor(private deps: GetPendingAdminInvitesDependencies) {}

  async execute(input: {
    organizationId: string;
    actorUserId: string;
  }): Promise<Result<Invitation[], string>> {
    const { organizationId, actorUserId } = input;

    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        organizationId
      );

      if (!isAdmin) {
        return failure(InvitationErrors.NOT_ADMIN);
      }
    }

    const invitations =
      await this.deps.invitationRepository.findPendingByOrganizationId(
        organizationId,
        'admin_invite'
      );

    return success(invitations);
  }
}
