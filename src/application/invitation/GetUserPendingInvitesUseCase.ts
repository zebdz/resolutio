import { InvitationRepository } from '../../domain/invitation/InvitationRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { BoardRepository } from '../../domain/board/BoardRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { User } from '../../domain/user/User';
import { Result, success } from '../../domain/shared/Result';
import { InviteDetails } from './GetInviteDetailsUseCase';

export interface GetUserPendingInvitesDependencies {
  invitationRepository: InvitationRepository;
  organizationRepository: OrganizationRepository;
  boardRepository: BoardRepository;
  userRepository: UserRepository;
}

export class GetUserPendingInvitesUseCase {
  constructor(private deps: GetUserPendingInvitesDependencies) {}

  async execute(input: {
    actorUserId: string;
  }): Promise<Result<InviteDetails[], string>> {
    const invitations =
      await this.deps.invitationRepository.findPendingByInviteeId(
        input.actorUserId
      );

    if (invitations.length === 0) {
      return success([]);
    }

    // Collect unique IDs for batch resolution
    const orgIds = [...new Set(invitations.map((inv) => inv.organizationId))];
    const inviterIds = [...new Set(invitations.map((inv) => inv.inviterId))];
    const boardIds = [
      ...new Set(
        invitations
          .map((inv) => inv.boardId)
          .filter((id): id is string => id !== null)
      ),
    ];

    // Fetch in parallel
    const [orgs, inviters, boards] = await Promise.all([
      Promise.all(
        orgIds.map((id) => this.deps.organizationRepository.findById(id))
      ),
      this.deps.userRepository.findByIds(inviterIds),
      Promise.all(boardIds.map((id) => this.deps.boardRepository.findById(id))),
    ]);

    // Build lookup maps
    const orgMap = new Map(
      orgs
        .filter((o): o is NonNullable<typeof o> => o !== null)
        .map((o) => [o.id, o])
    );
    const inviterMap = new Map(inviters.map((u) => [u.id, u]));
    const boardMap = new Map(
      boards
        .filter((b): b is NonNullable<typeof b> => b !== null)
        .map((b) => [b.id, b])
    );

    const details: InviteDetails[] = invitations.map((inv) => {
      const org = orgMap.get(inv.organizationId);
      const inviter = inviterMap.get(inv.inviterId);
      const board = inv.boardId ? boardMap.get(inv.boardId) : null;

      return {
        id: inv.id,
        type: inv.type,
        status: inv.status,
        organizationName: org?.name || '',
        organizationId: inv.organizationId,
        boardName: board?.name || null,
        boardId: inv.boardId,
        inviterName: inviter
          ? User.formatFullName(
              inviter.firstName,
              inviter.lastName,
              inviter.middleName
            )
          : '',
        inviteeId: inv.inviteeId,
        createdAt: inv.createdAt,
      };
    });

    return success(details);
  }
}
