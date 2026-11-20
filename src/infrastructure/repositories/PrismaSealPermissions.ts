/** Resolve current poll audience and membership for sealed exports. The policy is
 * shared with results pages. Query only participant identity for authorization. */
import { PrismaClient } from '@/generated/prisma/client';
import { SealPermissions } from '@/application/seal/SealExports';
import { PollResultsPolicy } from '@/domain/poll/PollResultsPolicy';
import { UserId, OrganizationId } from '@/domain/shared/EntityIds';
import { PollId, UserId as SealUserId } from '@/domain/seal/SealValues';
import { success, failure } from '@/domain/shared/Result';
import { PrismaOrganizationRepository } from './PrismaOrganizationRepository';
import { PrismaUserRepository } from './PrismaUserRepository';

export class PrismaSealPermissions implements SealPermissions {
  constructor(private readonly db: PrismaClient) {}
  async forViewer(
    pollId: PollId,
    userId: SealUserId
  ): ReturnType<SealPermissions['forViewer']> {
    try {
      const poll = await this.db.poll.findUnique({
        where: { id: pollId },
        select: {
          state: true,
          anonymous: true,
          pollType: true,
          organizationId: true,
          participants: { where: { userId }, select: { id: true }, take: 1 },
        },
      });

      if (!poll || poll.state !== 'FINISHED') {
        return success({ results: false, names: false, signers: false });
      }

      const org = new PrismaOrganizationRepository(this.db);
      const organization = OrganizationId.parse(poll.organizationId);
      const user = UserId.parse(userId);
      const [platform, admin, member] = await Promise.all([
        new PrismaUserRepository(this.db).isSuperAdmin(user),
        org.isUserAdmin(user, organization),
        org.isUserMember(user, organization),
      ]);
      const facts = {
        isAdmin: platform || admin,
        isOrgMember: member,
        isPollVoter: poll.participants.length > 0,
      };
      const state = {
        isOpen: () => poll.pollType === 'OPEN',
        isAnonymous: () => poll.anonymous,
        isActive: () => false,
      };

      return success({
        results: PollResultsPolicy.canViewResults(state, facts).success,
        names: PollResultsPolicy.canViewVoterNames(state, facts),
        signers: PollResultsPolicy.canViewSignWillingness(facts),
      });
    } catch {
      return failure('common.errors.unexpected');
    }
  }
}
