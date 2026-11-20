/** Reads the current audience, membership and poll lifecycle before disclosing
 * a frozen record. Authorization queries select no ballot contents or identities of other voters. */
import { PrismaClient } from '@/generated/prisma/client';
import { SealPermissions } from '@/application/seal/SealExports';
import { ProtocolViewerReader } from '@/application/seal/GetSealedProtocolUseCase';
import { PollResultsPolicy } from '@/domain/poll/PollResultsPolicy';
import { UserId, OrganizationId } from '@/domain/shared/EntityIds';
import { PollId, UserId as SealUserId } from '@/domain/seal/SealValues';
import { success, failure } from '@/domain/shared/Result';
import { PrismaOrganizationRepository } from './PrismaOrganizationRepository';
import { PrismaUserRepository } from './PrismaUserRepository';

export class PrismaSealPermissions
  implements SealPermissions, ProtocolViewerReader
{
  constructor(private readonly db: PrismaClient) {}

  forProtocol(pollId: PollId, userId: SealUserId) {
    return this.readViewer(pollId, userId, false);
  }

  async forViewer(
    pollId: PollId,
    userId: SealUserId
  ): ReturnType<SealPermissions['forViewer']> {
    const viewer = await this.readViewer(pollId, userId, true);

    if (!viewer.success) {
      return viewer;
    }

    if (!viewer.value) {
      return success({ results: false, names: false, signers: false });
    }

    const { facts, anonymous, isOpen } = viewer.value;
    const state = {
      isOpen: () => isOpen,
      isAnonymous: () => anonymous,
      isActive: () => false,
    };

    return success({
      results: PollResultsPolicy.canViewResults(state, facts).success,
      names: PollResultsPolicy.canViewVoterNames(state, facts),
      signers: PollResultsPolicy.canViewSignWillingness(facts),
    });
  }

  private async readViewer(
    pollId: PollId,
    userId: SealUserId,
    finishedOnly: boolean
  ): ReturnType<ProtocolViewerReader['forProtocol']> {
    try {
      const poll = await this.db.poll.findUnique({
        where: { id: pollId },
        select: {
          state: true,
          finishedAt: true,
          anonymous: true,
          pollType: true,
          organizationId: true,
          participants: { where: { userId }, select: { id: true }, take: 1 },
        },
      });

      if (!poll || (finishedOnly && poll.state !== 'FINISHED')) {
        return success(null);
      }

      const org = new PrismaOrganizationRepository(this.db);
      const organization = OrganizationId.parse(poll.organizationId);
      const user = UserId.parse(userId);
      const [platform, admin, member] = await Promise.all([
        new PrismaUserRepository(this.db).isSuperAdmin(user),
        org.isUserAdmin(user, organization),
        org.isUserMember(user, organization),
      ]);

      return success({
        state: poll.state,
        hasFinishedAt: poll.finishedAt !== null,
        isOpen: poll.pollType === 'OPEN',
        anonymous: poll.anonymous,
        facts: {
          isAdmin: platform || admin,
          isOrgMember: member,
          isPollVoter: poll.participants.length > 0,
        },
      });
    } catch {
      return failure('common.errors.unexpected');
    }
  }
}
