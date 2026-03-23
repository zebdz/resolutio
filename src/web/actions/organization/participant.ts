'use server';

import { getTranslations } from 'next-intl/server';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { GetParticipantsUseCase } from '@/application/poll/GetParticipantsUseCase';
import { UpdateParticipantWeightUseCase } from '@/application/poll/UpdateParticipantWeightUseCase';
import { RemoveParticipantUseCase } from '@/application/poll/RemoveParticipantUseCase';
import { GetWeightHistoryUseCase } from '@/application/poll/GetWeightHistoryUseCase';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
  PrismaUserRepository,
  PrismaBoardRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../../lib/session';
import { User } from '@/domain/user/User';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import { z } from 'zod';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';
import { SharedDomainCodes } from '@/domain/shared/SharedDomainCodes';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const profanityChecker = LeoProfanityChecker.getInstance();

// Use cases
const getParticipantsUseCase = new GetParticipantsUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository,
  prisma
);
const updateParticipantWeightUseCase = new UpdateParticipantWeightUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository,
  boardRepository,
  profanityChecker
);
const removeParticipantUseCase = new RemoveParticipantUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  organizationRepository,
  userRepository,
  boardRepository
);
const getWeightHistoryUseCase = new GetWeightHistoryUseCase(
  pollRepository,
  participantRepository,
  organizationRepository,
  userRepository,
  prisma
);

// Schema for weight update
const UpdateWeightSchema = z.object({
  participantId: z.string(),
  newWeight: z.number().positive(),
  reason: z
    .string()
    .refine((val) => !profanityChecker.containsProfanity(val), {
      message: SharedDomainCodes.CONTAINS_PROFANITY,
    })
    .optional(),
});

/**
 * Get participants for a poll
 */
export async function getParticipantsAction(
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
    const result = await getParticipantsUseCase.execute({
      pollId,
      adminUserId: user.id,
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
    console.error('Get participants error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Update participant weight
 */
export async function updateParticipantWeightAction(data: {
  participantId: string;
  newWeight: number;
  reason?: string;
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
    const validation = UpdateWeightSchema.safeParse(data);

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
    const result = await updateParticipantWeightUseCase.execute({
      participantId: validation.data.participantId,
      newWeight: validation.data.newWeight,
      adminUserId: user.id,
      reason: validation.data.reason,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Update participant weight error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Remove participant from poll
 */
export async function removeParticipantAction(
  participantId: string
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
    const result = await removeParticipantUseCase.execute({
      participantId,
      adminUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Remove participant error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Get weight history for a poll
 */
export async function getWeightHistoryAction(
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
    const result = await getWeightHistoryUseCase.execute({
      pollId,
      adminUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    // Serialize history data for client component
    const serializedHistory = result.value.history.map((item) => ({
      id: item.history.id,
      participantId: item.history.participantId,
      oldWeight: item.history.oldWeight,
      newWeight: item.history.newWeight,
      reason: item.history.reason || '',
      changedBy: User.formatFullName(
        item.changedByUser.firstName,
        item.changedByUser.lastName,
        item.changedByUser.middleName
      ),
      changedAt: item.history.changedAt.toISOString(),
    }));

    return {
      success: true,
      data: serializedHistory,
    };
  } catch (error) {
    console.error('Get weight history error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}
