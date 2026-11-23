/** Persist eligibility and its audit entry atomically, and scope history to administrators
 * of the exact organization. The audit references users independently of membership. */
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import {
  EligibilityChangeId,
  type EligibilityHistoryQuery,
  type EligibilityChange,
  type VotingEligibilityStore,
} from '@/application/organization/VotingEligibility';
import type { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { failure, success } from '@/domain/shared/Result';
import { User } from '@/domain/user/User';

async function authorizedOrganization(
  tx: Prisma.TransactionClient,
  org: OrganizationId,
  actor: UserId
) {
  const [row] = await tx.$queryRaw<{ archived_at: Date | null }[]>`
    SELECT o.archived_at FROM organizations o WHERE o.id=${org} AND
    (EXISTS (SELECT FROM organization_admin_users a WHERE a.organization_id=o.id AND a.user_id=${actor})
     OR EXISTS (SELECT FROM superadmins s WHERE s.user_id=${actor})) FOR SHARE OF o`;

  return row;
}

const person = {
  firstName: true,
  lastName: true,
  middleName: true,
  nickname: true,
} as const;
const pageSize = 20;
export class PrismaVotingEligibilityStore implements VotingEligibilityStore {
  constructor(private readonly db: PrismaClient) {}

  async ownStatus(organizationId: OrganizationId, viewer: UserId) {
    const row = await this.db.organizationUser.findFirst({
      where: { organizationId, userId: viewer, status: 'accepted' },
      select: { votingEligible: true },
    });

    return row?.votingEligible ?? null;
  }

  async change(
    actor: UserId,
    change: EligibilityChange
  ): ReturnType<VotingEligibilityStore['change']> {
    const { organizationId, memberId, eligible, reason } = change;

    return this.db.$transaction(async (tx) => {
      const org = await authorizedOrganization(tx, organizationId, actor);

      if (!org) {
        return failure('organization.errors.notAdmin' as const);
      }

      if (org.archived_at) {
        return failure('organization.errors.archived' as const);
      }

      const membership = {
        organizationId,
        userId: memberId,
        status: 'accepted',
      };
      const updated = await tx.organizationUser.updateMany({
        where: { ...membership, votingEligible: !eligible },
        data: { votingEligible: eligible },
      });

      if (!updated.count) {
        const exists = await tx.organizationUser.findFirst({
          where: membership,
          select: { id: true },
        });

        return exists
          ? success(undefined)
          : failure('organization.errors.notMember' as const);
      }

      await tx.membershipEligibilityChange.create({
        data: {
          organizationId,
          memberId,
          actorId: actor,
          wasEligible: !eligible,
          eligible,
          reason,
        },
      });

      return success(undefined);
    });
  }

  async history(
    actor: UserId,
    { organizationId, before }: EligibilityHistoryQuery
  ): ReturnType<VotingEligibilityStore['history']> {
    return this.db.$transaction(async (tx) => {
      if (!(await authorizedOrganization(tx, organizationId, actor))) {
        return failure('organization.errors.notAdmin' as const);
      }

      const rows = await tx.membershipEligibilityChange.findMany({
        where: {
          organizationId,
          ...(before && { id: { lt: BigInt(before) } }),
        },
        orderBy: { id: 'desc' },
        take: pageSize + 1,
        select: {
          id: true,
          wasEligible: true,
          eligible: true,
          reason: true,
          changedAt: true,
          actor: { select: person },
          member: { select: person },
        },
      });
      const entries = rows.slice(0, pageSize).map((r) => ({
        id: EligibilityChangeId.parse(String(r.id)),
        wasEligible: r.wasEligible,
        eligible: r.eligible,
        reason: r.reason,
        changedAt: r.changedAt.toISOString(),
        memberName: User.formatFullName(
          r.member.firstName,
          r.member.lastName,
          r.member.middleName
        ),
        memberNickname: r.member.nickname,
        actorName: User.formatFullName(
          r.actor.firstName,
          r.actor.lastName,
          r.actor.middleName
        ),
        actorNickname: r.actor.nickname,
      }));

      return success({
        entries,
        next: rows.length > pageSize ? entries[pageSize - 1].id : null,
      });
    });
  }
}
