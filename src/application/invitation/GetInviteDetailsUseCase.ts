import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors } from './InvitationErrors';
import {
  InvitationType,
  InvitationStatus,
} from '../../domain/invitation/Invitation';

export interface InviteDetails {
  id: string;
  type: InvitationType;
  status: InvitationStatus;
  organizationName: string;
  organizationId: string;
  boardName: string | null;
  boardId: string | null;
  inviterName: string;
  inviteeId: string;
  createdAt: Date;
}

export interface GetInviteDetailsDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
}

export class GetInviteDetailsUseCase {
  constructor(private deps: GetInviteDetailsDependencies) {}

  async execute(invitationId: string): Promise<Result<InviteDetails, string>> {
    const invitation =
      await this.deps.invitationRepository.findById(invitationId);

    if (!invitation) {
      return failure(InvitationErrors.NOT_FOUND);
    }

    const [organization, inviter] = await Promise.all([
      this.deps.organizationRepository.findById(invitation.organizationId),
      this.deps.userRepository.findById(invitation.inviterId),
    ]);

    let boardName: string | null = null;

    if (invitation.boardId) {
      const board = await this.deps.boardRepository.findById(
        invitation.boardId
      );
      boardName = board?.name || null;
    }

    const inviterName = inviter
      ? User.formatFullName(
          inviter.firstName,
          inviter.lastName,
          inviter.middleName
        )
      : '';

    return success({
      id: invitation.id,
      type: invitation.type,
      status: invitation.status,
      organizationName: organization?.name || '',
      organizationId: invitation.organizationId,
      boardName,
      boardId: invitation.boardId,
      inviterName,
      inviteeId: invitation.inviteeId,
      createdAt: invitation.createdAt,
    });
  }
}
