'use server';

/** Admin analysis actions authorize poll access and serialize validated snapshot metadata.
 * Provider output and internal objects never bypass the application's checked model. */
import { PollId, LegalCheckId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import type { AIModelKey, LegalIssueCount } from '@/domain/ai/LegalAnalysis';
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
  id: LegalCheckId;
  pollId: PollId;
  model: AIModelKey;
  annotations: LegalAnnotation[];
  summary: LegalAnalysisSummary;
  overallRisk: 'low' | 'medium' | 'high';
  totalIssues: LegalIssueCount;
  checkedBy: UserId;
  checkedAt: Instant;
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
    return {
      success: false,
      error: await translateErrorCode('common.errors.unauthorized'),
    };
  }

  const id = PollId.safeParse(pollId);

  if (!id.success) {
    return {
      success: false,
      error: await translateErrorCode(AIErrors.POLL_NOT_FOUND),
    };
  }

  const pollResult = await pollRepository.getPollById(id.data);

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

  const result = await legalCheckRepository.findByPollId(poll.id);

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
      checkedAt: Instant.fromDate(props.checkedAt),
      isStale: result.isStale,
    },
  };
}

export async function markLegalCheckStaleAction(pollId: string): Promise<void> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return;
  }

  const user = await getCurrentUser();

  if (!user) {
    return;
  }

  const id = PollId.safeParse(pollId);

  if (!id.success) {
    return;
  }

  const found = await pollRepository.getPollById(id.data);

  if (!found.success || !found.value) {
    return;
  }

  const isSuperadmin = await userRepository.isSuperAdmin(user.id);

  if (
    !isSuperadmin &&
    !(await organizationRepository.isUserAdmin(
      user.id,
      found.value.organizationId
    ))
  ) {
    return;
  }

  await onPollContentChanged(found.value.id, legalCheckRepository);
}
