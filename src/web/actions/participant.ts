'use server';

import { getTranslations } from 'next-intl/server';
import { GetParticipantsUseCase } from '@/application/poll/GetParticipantsUseCase';
import { UpdateParticipantWeightUseCase } from '@/application/poll/UpdateParticipantWeightUseCase';
import { RemoveParticipantUseCase } from '@/application/poll/RemoveParticipantUseCase';
import { GetWeightHistoryUseCase } from '@/application/poll/GetWeightHistoryUseCase';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../lib/session';
import { z } from 'zod';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);

// Use cases
const getParticipantsUseCase = new GetParticipantsUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  boardRepository,
  organizationRepository,
  prisma
);
const updateParticipantWeightUseCase = new UpdateParticipantWeightUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  boardRepository,
  organizationRepository
);
const removeParticipantUseCase = new RemoveParticipantUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  boardRepository,
  organizationRepository
);
const getWeightHistoryUseCase = new GetWeightHistoryUseCase(
  pollRepository,
  participantRepository,
  boardRepository,
  organizationRepository,
  prisma
);

// Schema for weight update
const UpdateWeightSchema = z.object({
  participantId: z.string(),
  newWeight: z.number().positive(),
  reason: z.string().optional(),
});

/**
 * Get participants for a poll
 */
export async function getParticipantsAction(
  pollId: string
): Promise<ActionResult<any>> {
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
      const errorT = await getTranslations();

      return {
        success: false,
        error: errorT(result.error as any),
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
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');

        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

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
      const errorT = await getTranslations();

      return {
        success: false,
        error: errorT(result.error as any),
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
      const errorT = await getTranslations();

      return {
        success: false,
        error: errorT(result.error as any),
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
      const errorT = await getTranslations();

      return {
        success: false,
        error: errorT(result.error as any),
      };
    }

    // Serialize history data for client component
    const serializedHistory = result.value.history.map((item) => ({
      id: item.history.id,
      participantId: item.history.participantId,
      oldWeight: item.history.oldWeight,
      newWeight: item.history.newWeight,
      reason: item.history.reason || '',
      changedBy: `${item.changedByUser.firstName} ${item.changedByUser.lastName}`,
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
