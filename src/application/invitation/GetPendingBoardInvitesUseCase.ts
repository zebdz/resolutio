import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors } from './InvitationErrors';

export interface GetPendingBoardInvitesDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
}

export class GetPendingBoardInvitesUseCase {
  constructor(private deps: GetPendingBoardInvitesDependencies) {}

  async execute(input: {
    boardId: string;
    actorUserId: string;
  }): Promise<Result<Invitation[], string>> {
    const { boardId, actorUserId } = input;

    const board = await this.deps.boardRepository.findById(boardId);

    if (!board) {
      return failure(InvitationErrors.BOARD_NOT_FOUND);
    }

    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        board.organizationId
      );

      if (!isAdmin) {
        return failure(InvitationErrors.NOT_ADMIN);
      }
    }

    const invitations =
      await this.deps.invitationRepository.findPendingByBoardId(boardId);

    return success(invitations);
  }
}
