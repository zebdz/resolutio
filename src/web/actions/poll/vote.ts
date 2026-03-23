'use server';

import { getTranslations } from 'next-intl/server';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { SubmitDraftUseCase } from '@/application/poll/SubmitDraftUseCase';
import { FinishVotingUseCase } from '@/application/poll/FinishVotingUseCase';
import { GetUserVotingProgressUseCase } from '@/application/poll/GetUserVotingProgressUseCase';
import { GetPollResultsUseCase } from '@/application/poll/GetPollResultsUseCase';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
  PrismaDraftRepository,
  PrismaBoardRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import { z } from 'zod';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const draftRepository = new PrismaDraftRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

// Use cases
const submitDraftUseCase = new SubmitDraftUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  draftRepository,
  organizationRepository,
  boardRepository
);
const finishVotingUseCase = new FinishVotingUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  draftRepository,
  organizationRepository,
  boardRepository
);
const getUserVotingProgressUseCase = new GetUserVotingProgressUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  draftRepository
);
const getPollResultsUseCase = new GetPollResultsUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository
);

// Schema for draft submission
const SubmitDraftSchema = z.object({
  pollId: z.string(),
  questionId: z.string(),
  answerId: z.string(),
  userId: z.string(),
  isSingleChoice: z.boolean(),
  shouldRemove: z.boolean().optional(),
});

/**
 * Submit a draft vote for a question
 */
export async function submitDraftAction(data: {
  pollId: string;
  questionId: string;
  answerId: string;
  isSingleChoice: boolean;
  shouldRemove?: boolean;
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Validate with Zod
    const validation = SubmitDraftSchema.safeParse({
      ...data,
      userId: user.id,
    });

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues
      );

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case
    const result = await submitDraftUseCase.execute(validation.data);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Submit draft error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Get user's voting progress for a poll
 */
export async function getUserVotingProgressAction(
  pollId: string
): Promise<ActionResult<any>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Execute use case
    const result = await getUserVotingProgressUseCase.execute({
      pollId,
      userId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: result.value,
    };
  } catch (error) {
    console.error('Get voting progress error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Finish voting on a poll
 */
export async function finishVotingAction(
  pollId: string,
  willingToSignProtocol: boolean
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Execute use case
    const result = await finishVotingUseCase.execute({
      pollId,
      userId: user.id,
      willingToSignProtocol,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Finish voting error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Get poll results
 */
export async function getPollResultsAction(
  pollId: string
): Promise<ActionResult<any>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Execute use case
    const result = await getPollResultsUseCase.execute({
      pollId,
      userId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: result.value,
    };
  } catch (error) {
    console.error('Get poll results error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Check if user can vote on a poll
 */
export async function canUserVoteAction(
  pollId: string
): Promise<ActionResult<{ canVote: boolean; reasonCode?: string }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Get the poll
    const pollResult = await pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return {
        success: false,
        error: await translateErrorCode(pollResult.error),
      };
    }

    const poll = pollResult.value;

    if (!poll) {
      return {
        success: false,
        error: await translateErrorCode('poll.errors.pollNotFound'),
      };
    }

    // Check if poll is active and not finished
    if (!poll.isActive()) {
      return {
        success: true,
        data: {
          canVote: false,
          reasonCode: 'pollNotActive',
        },
      };
    }

    if (poll.isFinished()) {
      return {
        success: true,
        data: {
          canVote: false,
          reasonCode: 'pollFinished',
        },
      };
    }

    // Check if user is a participant
    const participantResult =
      await participantRepository.getParticipantByUserAndPoll(pollId, user.id);

    if (!participantResult.success) {
      return {
        success: false,
        error: await translateErrorCode(participantResult.error),
      };
    }

    if (!participantResult.value) {
      return {
        success: true,
        data: {
          canVote: false,
          reasonCode: 'cannotVote',
        },
      };
    }

    // Check if user has already finished voting
    const hasFinishedResult = await voteRepository.hasUserFinishedVoting(
      pollId,
      user.id
    );

    if (!hasFinishedResult.success) {
      return {
        success: false,
        error: await translateErrorCode(hasFinishedResult.error),
      };
    }

    if (hasFinishedResult.value) {
      return {
        success: true,
        data: {
          canVote: false,
          reasonCode: 'alreadyVoted',
        },
      };
    }

    return {
      success: true,
      data: {
        canVote: true,
      },
    };
  } catch (error) {
    console.error('Can user vote error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}
