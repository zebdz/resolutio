/** Decodes invitation request references before authorization and domain transitions. */
import { z } from 'zod';
import { BoardId, UserId, InvitationId } from '@/domain/shared/EntityIds';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Invitation } from '../../domain/invitation/Invitation';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors, InvitationUseCaseFailure } from './InvitationErrors';

export interface GetPendingBoardInvitesDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
}

export class GetPendingBoardInvitesUseCase {
  constructor(private deps: GetPendingBoardInvitesDependencies) {}

  async execute(rawInput: {
    boardId: string;
    actorUserId: string;
  }): Promise<Result<Invitation[], InvitationUseCaseFailure>> {
    const parsed = z
      .object({ boardId: BoardId, actorUserId: UserId })
      .safeParse(rawInput);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const input = { ...rawInput, ...parsed.data };

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
