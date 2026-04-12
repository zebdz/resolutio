'use server';

import { checkRateLimit } from '@/web/actions/rateLimit';
import { getCurrentUser } from '@/web/lib/session';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { PrismaLegalCheckRepository } from '@/infrastructure/repositories/PrismaLegalCheckRepository';
import { AIErrors } from '@/application/ai/AIErrors';
import { onPollContentChanged } from '@/application/ai/onPollContentChanged';
import type {
  LegalAnnotation,
  LegalAnalysisSummary,
} from '@/application/ai/legalAnalysisSchema';

const pollRepository = new PrismaPollRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const legalCheckRepository = new PrismaLegalCheckRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

export interface SerializedLegalCheck {
  id: string;
  pollId: string;
  model: string;
  annotations: LegalAnnotation[];
  summary: LegalAnalysisSummary;
  overallRisk: 'low' | 'medium' | 'high';
  totalIssues: number;
  checkedBy: string;
  checkedAt: string;
  isStale: boolean;
}

export type GetLegalCheckResult =
  | { success: true; data: SerializedLegalCheck | null }
  | { success: false; error: string };

export async function getLegalCheckAction(
  pollId: string
): Promise<GetLegalCheckResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: 'Unauthorized' };
  }

  const pollResult = await pollRepository.getPollById(pollId);

  if (!pollResult.success || !pollResult.value) {
    return {
      success: false,
      error: await translateErrorCode(AIErrors.POLL_NOT_FOUND),
    };
  }

  const poll = pollResult.value;

  const isSuperadmin = await userRepository.isSuperAdmin(user.id);

  if (!isSuperadmin) {
    const isAdmin = await organizationRepository.isUserAdmin(
      user.id,
      poll.organizationId
    );

    if (!isAdmin) {
      return {
        success: false,
        error: await translateErrorCode(AIErrors.NOT_ADMIN),
      };
    }
  }

  const result = await legalCheckRepository.findByPollId(pollId);

  if (!result) {
    return { success: true, data: null };
  }

  const props = result.check.toJSON();

  return {
    success: true,
    data: {
      id: props.id,
      pollId: props.pollId,
      model: props.model,
      annotations: props.annotations,
      summary: props.summary,
      overallRisk: props.overallRisk,
      totalIssues: props.totalIssues,
      checkedBy: props.checkedBy,
      checkedAt: props.checkedAt.toISOString(),
      isStale: result.isStale,
    },
  };
}

export async function markLegalCheckStaleAction(pollId: string): Promise<void> {
  await onPollContentChanged(pollId, legalCheckRepository);
}
