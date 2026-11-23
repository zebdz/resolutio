'use server';

/** Take the audit actor from the session and localize errors for both admin controls. */
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { prisma } from '@/infrastructure/database/prisma';
import { PrismaVotingEligibilityStore } from '@/infrastructure/repositories/PrismaVotingEligibilityStore';
import { VotingEligibility } from '@/application/organization/VotingEligibility';

const service = new VotingEligibility(new PrismaVotingEligibilityStore(prisma));

export async function setMembershipVotingEligibility(input: {
  organizationId: string;
  memberId: string;
  eligible: boolean;
  reason: string;
}) {
  const limited = await checkRateLimit();

  if (limited) {
    return limited;
  }

  const actor = await getCurrentUser();

  if (!actor) {
    return {
      success: false as const,
      error: await translateErrorCode('common.errors.unauthorized'),
    };
  }

  const result = await service.change(actor.id, input);

  return result.success
    ? { success: true as const }
    : {
        success: false as const,
        error: await translateErrorCode(result.error),
      };
}

export async function eligibilityHistory(
  organizationId: string,
  before?: string
) {
  const limited = await checkRateLimit();

  if (limited) {
    return limited;
  }

  const actor = await getCurrentUser();

  if (!actor) {
    return {
      success: false as const,
      error: await translateErrorCode('common.errors.unauthorized'),
    };
  }

  const result = await service.history(actor.id, { organizationId, before });

  return result.success
    ? { success: true as const, data: result.value }
    : {
        success: false as const,
        error: await translateErrorCode(result.error),
      };
}
