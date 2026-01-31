'use server';

import { getTranslations } from 'next-intl/server';
import { CreatePollUseCase } from '@/application/poll/CreatePollUseCase';
import { UpdatePollUseCase } from '@/application/poll/UpdatePollUseCase';
import { AddQuestionUseCase } from '@/application/poll/AddQuestionUseCase';
import { UpdateQuestionUseCase } from '@/application/poll/UpdateQuestionUseCase';
import { DeleteQuestionUseCase } from '@/application/poll/DeleteQuestionUseCase';
import { CreateAnswerUseCase } from '@/application/poll/CreateAnswerUseCase';
import { UpdateAnswerUseCase } from '@/application/poll/UpdateAnswerUseCase';
import { DeleteAnswerUseCase } from '@/application/poll/DeleteAnswerUseCase';
import { UpdateQuestionOrderUseCase } from '@/application/poll/UpdateQuestionOrderUseCase';
import { TakeSnapshotUseCase } from '@/application/poll/TakeSnapshotUseCase';
import { ActivatePollUseCase } from '@/application/poll/ActivatePollUseCase';
import { DeactivatePollUseCase } from '@/application/poll/DeactivatePollUseCase';
import { DiscardSnapshotUseCase } from '@/application/poll/DiscardSnapshotUseCase';
import { FinishPollUseCase } from '@/application/poll/FinishPollUseCase';
import {
  CreatePollSchema,
  UpdatePollSchema,
  AddQuestionSchema,
  UpdateQuestionOrderSchema,
} from '@/application/poll/PollSchemas';
import {
  prisma,
  PrismaPollRepository,
  PrismaBoardRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaParticipantRepository,
  PrismaVoteRepository,
  PrismaQuestionRepository,
  PrismaAnswerRepository,
  PrismaDraftRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../lib/session';
import { QuestionType } from '@/domain/poll/QuestionType';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const pollRepository = new PrismaPollRepository(prisma);
const participantRepository = new PrismaParticipantRepository(prisma);
const voteRepository = new PrismaVoteRepository(prisma);
const questionRepository = new PrismaQuestionRepository(prisma);
const answerRepository = new PrismaAnswerRepository(prisma);
const draftRepository = new PrismaDraftRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

// Use cases
const createPollUseCase = new CreatePollUseCase(
  pollRepository,
  boardRepository
);
const updatePollUseCase = new UpdatePollUseCase(pollRepository, voteRepository);
const addQuestionUseCase = new AddQuestionUseCase(
  pollRepository,
  questionRepository,
  answerRepository
);
const updateQuestionUseCase = new UpdateQuestionUseCase(
  pollRepository,
  questionRepository,
  voteRepository
);
const deleteQuestionUseCase = new DeleteQuestionUseCase(
  pollRepository,
  questionRepository,
  voteRepository
);
const createAnswerUseCase = new CreateAnswerUseCase(
  pollRepository,
  questionRepository,
  answerRepository,
  voteRepository
);
const updateAnswerUseCase = new UpdateAnswerUseCase(
  pollRepository,
  questionRepository,
  answerRepository,
  voteRepository
);
const deleteAnswerUseCase = new DeleteAnswerUseCase(
  pollRepository,
  questionRepository,
  answerRepository,
  voteRepository
);
const updateQuestionOrderUseCase = new UpdateQuestionOrderUseCase(
  pollRepository,
  questionRepository
);
const takeSnapshotUseCase = new TakeSnapshotUseCase(
  pollRepository,
  participantRepository,
  boardRepository,
  organizationRepository,
  userRepository
);
const activatePollUseCase = new ActivatePollUseCase(
  pollRepository,
  boardRepository,
  organizationRepository,
  userRepository
);
const deactivatePollUseCase = new DeactivatePollUseCase(
  pollRepository,
  boardRepository,
  organizationRepository,
  userRepository
);
const discardSnapshotUseCase = new DiscardSnapshotUseCase(
  pollRepository,
  participantRepository,
  voteRepository,
  boardRepository,
  organizationRepository,
  userRepository
);
const finishPollUseCase = new FinishPollUseCase(
  pollRepository,
  draftRepository,
  boardRepository,
  organizationRepository,
  userRepository
);

export async function createPollAction(
  formData: FormData
): Promise<ActionResult<{ pollId: string }>> {
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

    // Extract form data
    const input = {
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      boardId: formData.get('boardId') as string,
      startDate: new Date(formData.get('startDate') as string),
      endDate: new Date(formData.get('endDate') as string),
    };

    // Validate with Zod
    const validation = CreatePollSchema.safeParse(input);

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
    const result = await createPollUseCase.execute({
      ...validation.data,
      createdBy: user.id,
    });

    if (!result.success) {
      const tError = await getTranslations(result.error.split('.')[0]);

      return {
        success: false,
        error: tError(result.error),
      };
    }

    return {
      success: true,
      data: {
        pollId: result.value.id,
      },
    };
  } catch (error) {
    console.error('Error creating poll:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function addQuestionAction(
  formData: FormData
): Promise<ActionResult<{ questionId: string }>> {
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

    // Parse FormData (same format as create page)
    const detailsValue = formData.get('details') as string | null;
    const answersJson = formData.get('answers') as string;

    let answerTexts: string[] = [];

    if (answersJson) {
      try {
        answerTexts = (JSON.parse(answersJson) as string[])
          .filter((text) => text.trim())
          .map((text) => text.trim());
      } catch (e) {
        // Invalid JSON, leave answers empty
      }
    }

    const parsedInput = {
      pollId: formData.get('pollId') as string,
      text: formData.get('text') as string,
      details: detailsValue && detailsValue.trim() ? detailsValue : undefined,
      page: parseInt(formData.get('page') as string),
      order: parseInt(formData.get('order') as string),
      questionType: formData.get('questionType') as QuestionType,
      answers: answerTexts,
    };

    // Validate with Zod
    const validation = AddQuestionSchema.safeParse(parsedInput);

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
    const result = await addQuestionUseCase.execute(validation.data);

    if (!result.success) {
      const parts = result.error.split('.');
      const tError = await getTranslations(parts.shift());

      return {
        success: false,
        error: tError(parts.join('.')),
      };
    }

    return {
      success: true,
      data: {
        questionId: result.value.id,
      },
    };
  } catch (error) {
    console.error('Error adding question:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function updateQuestionOrderAction(input: {
  pollId: string;
  updates: { questionId: string; page: number; order: number }[];
}): Promise<ActionResult> {
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
    const validation = UpdateQuestionOrderSchema.safeParse(input);

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
    const result = await updateQuestionOrderUseCase.execute(validation.data);

    if (!result.success) {
      const tError = await getTranslations(result.error.split('.')[0]);

      return {
        success: false,
        error: tError(result.error),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error updating question order:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getUserPollsAction(): Promise<ActionResult<any[]>> {
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

    const result = await pollRepository.getPollsByUserId(user.id);

    if (!result.success) {
      const tError = await getTranslations(result.error.split('.')[0]);

      return {
        success: false,
        error: tError(result.error),
      };
    }

    // For each poll, check if user can vote and voting progress
    const pollsWithVotingStatus = await Promise.all(
      result.value.map(async (poll) => {
        const pollJson: any = poll.toJSON();

        // Get organizationId from board
        const board = await boardRepository.findById(poll.boardId);
        pollJson.organizationId = board?.organizationId || null;

        // Check if user can vote
        const participant = await prisma.pollParticipant.findFirst({
          where: {
            pollId: poll.id,
            userId: user.id,
          },
        });

        pollJson.canVote = !!participant;

        // Check if user has finished voting
        if (participant) {
          const votesCount = await prisma.vote.count({
            where: {
              userId: user.id,
              question: {
                pollId: poll.id,
              },
            },
          });

          const totalQuestions = pollJson.questions?.length || 0;
          pollJson.hasFinishedVoting =
            votesCount >= totalQuestions && totalQuestions > 0;
        } else {
          pollJson.hasFinishedVoting = false;
        }

        return pollJson;
      })
    );

    return {
      success: true,
      data: pollsWithVotingStatus,
    };
  } catch (error) {
    console.error('Error getting user polls:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getPollsByBoardIdAction(
  boardId: string
): Promise<ActionResult<any[]>> {
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

    // Check if user is a board member
    const isMember = await boardRepository.isUserMember(user.id, boardId);

    if (!isMember) {
      return {
        success: false,
        error: 'User is not a member of this board',
      };
    }

    const result = await pollRepository.getPollsByBoardId(boardId);

    if (!result.success) {
      const tError = await getTranslations(result.error.split('.')[0]);

      return {
        success: false,
        error: tError(result.error),
      };
    }

    return {
      success: true,
      data: result.value.map((poll) => poll.toJSON()),
    };
  } catch (error) {
    console.error('Error getting polls:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getPollByIdAction(
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

    const result = await pollRepository.getPollById(pollId);

    if (!result.success) {
      const translationKey = result.error.split('.')[0];
      const tError = translationKey
        ? await getTranslations(translationKey)
        : null;

      console.error(`getPollByIdAction error: ${result.error}`);

      return {
        success: false,
        error: tError ? tError(result.error) : t('generic'),
      };
    }

    if (!result.value) {
      return {
        success: false,
        error: t('poll.errors.pollNotFound'),
      };
    }

    // Check if user is a board member
    const poll = result.value;
    const isMember = await boardRepository.isUserMember(user.id, poll.boardId);

    if (!isMember) {
      return {
        success: false,
        error: t('board.errors.notMember'),
      };
    }

    return {
      success: true,
      data: poll.toJSON(),
    };
  } catch (error) {
    console.error('Error getting poll:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function updatePollAction(
  formData: FormData
): Promise<ActionResult> {
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

    // Extract form data
    const input = {
      pollId: formData.get('pollId') as string,
      title: formData.get('title') as string,
      description: formData.get('description') as string,
      startDate: new Date(formData.get('startDate') as string),
      endDate: new Date(formData.get('endDate') as string),
    };

    // Validate with Zod
    const validation = UpdatePollSchema.safeParse(input);

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
    const result = await updatePollUseCase.execute({
      ...validation.data,
      userId: user.id,
    });

    if (!result.success) {
      const tError = await getTranslations(result.error.split('.')[0]);

      return {
        success: false,
        error: tError(result.error),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error updating poll:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export async function canEditPollAction(
  pollId: string
): Promise<ActionResult<{ canEdit: boolean; reason?: string }>> {
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

    // Get poll
    const pollResult = await pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return {
        success: false,
        error: pollResult.error,
      };
    }

    const poll = pollResult.value;

    if (!poll) {
      return {
        success: false,
        error: 'Poll not found',
      };
    }

    // Check if user is creator
    if (poll.createdBy !== user.id) {
      return {
        success: true,
        data: {
          canEdit: false,
          reason: 'notCreator',
        },
      };
    }

    // Check if poll has votes
    const hasVotesResult = await voteRepository.pollHasVotes(pollId);

    if (!hasVotesResult.success) {
      return {
        success: false,
        error: hasVotesResult.error,
      };
    }

    const hasVotes = hasVotesResult.value;

    // Check if poll can be edited
    const canEditResult = poll.canEdit(hasVotes);

    if (!canEditResult.success) {
      return {
        success: false,
        error: canEditResult.error,
      };
    }

    if (!canEditResult.value) {
      let reason = 'unknown';

      if (poll.isActive()) {
        reason = 'active';
      } else if (poll.isFinished()) {
        reason = 'finished';
      } else if (hasVotes) {
        reason = 'hasVotes';
      }

      return {
        success: true,
        data: {
          canEdit: false,
          reason,
        },
      };
    }

    return {
      success: true,
      data: {
        canEdit: true,
      },
    };
  } catch (error) {
    console.error('Error checking if poll can be edited:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export async function updateQuestionAction(data: {
  questionId: string;
  text?: string;
  details?: string | null;
  questionType?: QuestionType;
}): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await updateQuestionUseCase.execute({
      questionId: data.questionId,
      userId: user.id,
      text: data.text,
      details: data.details,
      questionType: data.questionType,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error updating question:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export async function deleteQuestionAction(
  questionId: string
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await deleteQuestionUseCase.execute({
      questionId,
      userId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting question:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export async function updateAnswerAction(data: {
  answerId: string;
  text?: string;
  order?: number;
}): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await updateAnswerUseCase.execute({
      answerId: data.answerId,
      userId: user.id,
      text: data.text,
      order: data.order,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error updating answer:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export async function createAnswerAction(data: {
  questionId: string;
  text: string;
  order: number;
}): Promise<ActionResult<{ answerId: string }>> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await createAnswerUseCase.execute({
      questionId: data.questionId,
      userId: user.id,
      text: data.text,
      order: data.order,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return {
      success: true,
      data: { answerId: result.value.id },
    };
  } catch (error) {
    console.error('Error creating answer:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export async function deleteAnswerAction(
  answerId: string
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await deleteAnswerUseCase.execute({
      answerId,
      userId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: result.error,
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error deleting answer:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Activate a poll
 */
export async function activatePollAction(
  pollId: string
): Promise<ActionResult<void>> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await activatePollUseCase.execute({
      pollId,
      userId: user.id,
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
    console.error('Error activating poll:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Deactivate a poll
 */
export async function deactivatePollAction(
  pollId: string
): Promise<ActionResult<void>> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await deactivatePollUseCase.execute({
      pollId,
      userId: user.id,
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
    console.error('Error deactivating poll:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Finish a poll
 */
export async function finishPollAction(
  pollId: string
): Promise<ActionResult<void>> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await finishPollUseCase.execute({
      pollId,
      userId: user.id,
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
    console.error('Error finishing poll:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Take a participant snapshot (DRAFT → READY)
 */
export async function takeSnapshotAction(
  pollId: string
): Promise<ActionResult<void>> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await takeSnapshotUseCase.execute({
      pollId,
      userId: user.id,
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
    console.error('Error taking snapshot:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Discard a participant snapshot (READY → DRAFT)
 * Only allowed if no votes have been cast
 */
export async function discardSnapshotAction(
  pollId: string
): Promise<ActionResult<void>> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await discardSnapshotUseCase.execute({
      pollId,
      userId: user.id,
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
    console.error('Error discarding snapshot:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Check if current user can manage a poll (superadmin or org admin)
 */
export async function canManagePollAction(
  pollId: string
): Promise<ActionResult<boolean>> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const pollResult = await pollRepository.getPollById(pollId);

    if (!pollResult.success) {
      return {
        success: false,
        error: t('unexpected'),
      };
    }

    const poll = pollResult.value;

    if (!poll) {
      const tPoll = await getTranslations('poll.errors');

      return {
        success: false,
        error: tPoll('pollNotFound'),
      };
    }

    const board = await boardRepository.findById(poll.boardId);

    if (!board) {
      const tPoll = await getTranslations('poll.errors');

      return {
        success: false,
        error: tPoll('boardNotFound'),
      };
    }

    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

    if (isSuperAdmin) {
      return { success: true, data: true };
    }

    const isOrgAdmin = await organizationRepository.isUserAdmin(
      user.id,
      board.organizationId
    );

    return { success: true, data: isOrgAdmin };
  } catch (error) {
    console.error('Error checking poll management permission:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}
