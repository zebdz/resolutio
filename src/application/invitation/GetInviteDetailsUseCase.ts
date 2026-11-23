/** Resolves one invitation into a typed projection through read ports.
 * Missing related names stay explicit; browser fallbacks are applied separately. */
import { InvitationId } from '@/domain/shared/EntityIds';
import { BoardName } from '@/domain/board/BoardName';
import { InviteDetails, invitationDetails } from './InviteDetails';
export type { InviteDetails } from './InviteDetails';
import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';
import { Result, success, failure } from '../../domain/shared/Result';
import { InvitationErrors, InvitationUseCaseFailure } from './InvitationErrors';

export interface GetInviteDetailsDependencies {
  invitationRepository: Pick<InvitationRepository, 'findById'>;
  organizationRepository: Pick<OrganizationRepository, 'findById'>;
  boardRepository: Pick<BoardRepository, 'findById'>;
  userRepository: Pick<UserRepository, 'findById'>;
}

export class GetInviteDetailsUseCase {
  constructor(private deps: GetInviteDetailsDependencies) {}

  async execute(
    rawInvitationId: string
  ): Promise<Result<InviteDetails, InvitationUseCaseFailure>> {
    const parsed = InvitationId.safeParse(rawInvitationId);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const invitationId = parsed.data;
    const invitation =
      await this.deps.invitationRepository.findById(invitationId);

    if (!invitation) {
      return failure(InvitationErrors.NOT_FOUND);
    }

    const [organization, inviter] = await Promise.all([
      this.deps.organizationRepository.findById(invitation.organizationId),
      this.deps.userRepository.findById(invitation.inviterId),
    ]);

    let boardName: BoardName | null = null;

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
      : null;

    return success(
      invitationDetails(invitation, {
        organization: organization?.name ?? null,
        board: boardName,
        inviter: inviterName,
      })
    );
  }
}
