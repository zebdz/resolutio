'use server';

import { getTranslations } from 'next-intl/server';
import { CreatePollUseCase } from '@/application/poll/CreatePollUseCase';
import { AddQuestionUseCase } from '@/application/poll/AddQuestionUseCase';
import { UpdateQuestionOrderUseCase } from '@/application/poll/UpdateQuestionOrderUseCase';
import {
  CreatePollSchema,
  AddQuestionSchema,
  UpdateQuestionOrderSchema,
} from '@/application/poll/PollSchemas';
import {
  prisma,
  PrismaPollRepository,
  PrismaBoardRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../lib/session';
import { QuestionType } from '@/domain/poll/QuestionType';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const pollRepository = new PrismaPollRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);

// Use cases
const createPollUseCase = new CreatePollUseCase(
  pollRepository,
  boardRepository
);
const addQuestionUseCase = new AddQuestionUseCase(pollRepository);
const updateQuestionOrderUseCase = new UpdateQuestionOrderUseCase(
  pollRepository
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

    // Extract form data
    const answersJson = formData.get('answers') as string;
    const answers = answersJson ? JSON.parse(answersJson) : [];
    const detailsValue = formData.get('details') as string | null;

    const input = {
      pollId: formData.get('pollId') as string,
      text: formData.get('text') as string,
      details: detailsValue && detailsValue.trim() ? detailsValue : undefined,
      page: parseInt(formData.get('page') as string),
      order: parseInt(formData.get('order') as string),
      questionType: formData.get('questionType') as QuestionType,
      answers,
    };

    // Validate with Zod
    const validation = AddQuestionSchema.safeParse(input);
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

    return {
      success: true,
      data: result.value.map((poll) => poll.toJSON()),
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
      const tError = await getTranslations(result.error.split('.')[0]);

      return {
        success: false,
        error: tError(result.error),
      };
    }

    if (!result.value) {
      return {
        success: false,
        error: 'Poll not found',
      };
    }

    // Check if user is a board member
    const poll = result.value;
    const isMember = await boardRepository.isUserMember(user.id, poll.boardId);
    if (!isMember) {
      return {
        success: false,
        error: 'User is not a member of this board',
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
