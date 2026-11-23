/** Decodes invitation request references before authorization and domain transitions. */
import { z } from 'zod';
import {
  OrganizationId,
  UserId,
  InvitationId,
  BoardId,
} from '@/domain/shared/EntityIds';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors, InvitationUseCaseFailure } from './InvitationErrors';

export interface GetPendingMemberInvitesDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class GetPendingMemberInvitesUseCase {
  constructor(private deps: GetPendingMemberInvitesDependencies) {}

  async execute(rawInput: {
    organizationId: string;
    actorUserId: string;
  }): Promise<Result<Invitation[], InvitationUseCaseFailure>> {
    const parsed = z
      .object({ organizationId: OrganizationId, actorUserId: UserId })
      .safeParse(rawInput);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...parsed.data };

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
        'member_invite'
      );

    return success(invitations);
  }
}
