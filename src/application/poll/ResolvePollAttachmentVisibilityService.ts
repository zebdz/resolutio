import { Poll } from '../../domain/poll/Poll';

export interface OrgRepoForPollVisibility {
  isUserMember(userId: string, organizationId: string): Promise<boolean>;
  isUserAdmin(userId: string, organizationId: string): Promise<boolean>;
}

export interface BoardRepoForPollVisibility {
  isUserMember(userId: string, boardId: string): Promise<boolean>;
}

export interface UserRepoForPollVisibility {
  isSuperAdmin(userId: string): Promise<boolean>;
}

/**
 * Who may read a poll's description attachments.
 *
 * This mirrors who may read the poll itself, and must never be more
 * permissive: the files are evidence embedded in the description, so seeing
 * a file is equivalent to seeing that part of the poll.
 *
 * - Open polls are voted on by the whole platform and their preview page
 *   needs no session, so a live open poll's evidence is public too.
 * - Organization polls are private to the organization, narrowing further to
 *   the board when the poll is board-scoped.
 * - Draft and archived polls are readable only by the people who can still
 *   act on them — a draft is mid-composition, an archived poll is withdrawn.
 *   Mirrors ResolveReportVisibilityService.
 */
export class ResolvePollAttachmentVisibilityService {
  constructor(
    private orgs: OrgRepoForPollVisibility,
    private boards: BoardRepoForPollVisibility,
    private users: UserRepoForPollVisibility
  ) {}

  async canRead(poll: Poll, viewerId: string | null): Promise<boolean> {
    // Overrides, logged-in only: creator, superadmin, and org admin always
    // read, including drafts and archived polls.
    if (viewerId) {
      if (poll.createdBy === viewerId) {
        return true;
      }

      if (await this.users.isSuperAdmin(viewerId)) {
        return true;
      }

      if (await this.orgs.isUserAdmin(viewerId, poll.organizationId)) {
        return true;
      }
    }

    // Beyond the overrides, a poll that is not live exposes nothing.
    if (poll.isDraft() || poll.isArchived()) {
      return false;
    }

    // Open polls need no session — this matches GetOpenPollPreviewUseCase,
    // which backs the public preview page.
    if (poll.isOpen()) {
      return true;
    }

    if (!viewerId) {
      return false;
    }

    if (!(await this.orgs.isUserMember(viewerId, poll.organizationId))) {
      return false;
    }

    // Board-scoped polls narrow the audience to that board's members.
    if (poll.boardId) {
      return this.boards.isUserMember(viewerId, poll.boardId);
    }

    return true;
  }
}
