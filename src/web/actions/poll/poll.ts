'use server';

/** Poll actions authenticate/rate-limit requests, wire application ports to Prisma
 * adapters and translate results for clients. Snapshot discard has an explicit transaction. */
import { PageNumber, PageSize } from '@/domain/shared/Pagination';
import { Instant } from '@/domain/shared/Instant';
import { PollReadPolicy } from '@/domain/poll/PollReadPolicy';
import type { PollSnapshot } from '@/domain/poll/Poll';
import type { UserPollView, PollSearchView } from './PollQueryViews';
import {
  readCreatePollForm,
  readUpdatePollForm,
  readQuestionForm,
} from './PollFormData';
import {
  PollId,
  BoardId,
  OrganizationId,
  QuestionId,
  AnswerId,
} from '@/domain/shared/EntityIds';
import {
  CryptoIdGenerator,
  SystemClock,
} from '@/infrastructure/shared/SystemEntityCreation';
import { getTranslations } from 'next-intl/server';
import { CreatePollUseCase } from '@/application/poll/CreatePollUseCase';
import { PreviewPollWeightConfigUseCase } from '@/application/poll/PreviewPollWeightConfigUseCase';
import { UpdatePollWeightConfigUseCase } from '@/application/poll/UpdatePollWeightConfigUseCase';
import { UpdatePollUseCase } from '@/application/poll/UpdatePollUseCase';
import { AddQuestionUseCase } from '@/application/poll/AddQuestionUseCase';
import { UpdateQuestionUseCase } from '@/application/poll/UpdateQuestionUseCase';
import { DeleteQuestionUseCase } from '@/application/poll/DeleteQuestionUseCase';
import { CreateAnswerUseCase } from '@/application/poll/CreateAnswerUseCase';
import { UpdateAnswerUseCase } from '@/application/poll/UpdateAnswerUseCase';
import { DeleteAnswerUseCase } from '@/application/poll/DeleteAnswerUseCase';
import { UpdateQuestionOrderUseCase } from '@/application/poll/UpdateQuestionOrderUseCase';
import { TakeSnapshotUseCase } from '@/application/poll/TakeSnapshotUseCase';
import { PollWeightCalculator } from '@/application/poll/PollWeightCalculator';
import { ActivatePollUseCase } from '@/application/poll/ActivatePollUseCase';
import { SubmitPollToAdminUseCase } from '@/application/poll/SubmitPollToAdminUseCase';
import { ReturnPollToDraftUseCase } from '@/application/poll/ReturnPollToDraftUseCase';
import { DeactivatePollUseCase } from '@/application/poll/DeactivatePollUseCase';
import { DiscardSnapshotUseCase } from '@/application/poll/DiscardSnapshotUseCase';
import { PrismaPollSnapshotTransaction } from '@/infrastructure/repositories/PrismaPollSnapshotTransaction';
import { FinishPollUseCase } from '@/application/poll/FinishPollUseCase';
import {
  createPollSchema,
  updatePollSchema,
  addQuestionSchema,
  updateQuestionSchema,
  addAnswerSchema,
  updateAnswerSchema,
  UpdateQuestionOrderSchema,
} from '@/application/poll/PollSchemas';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';
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
  PrismaNotificationRepository,
  PrismaPropertyAssetRepository,
  PrismaPollEligibleMemberRepository,
  PrismaOrganizationPropertyRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { QuestionType } from '@/domain/poll/QuestionType';
import { PollState } from '@/domain/poll/PollState';
import { PollSearchFilters } from '@/domain/poll/PollRepository';

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
const notificationRepository = new PrismaNotificationRepository(prisma);
const propertyAssetRepository = new PrismaPropertyAssetRepository(prisma);
const pollEligibleMemberRepository = new PrismaPollEligibleMemberRepository(
  prisma
);
const organizationPropertyRepository = new PrismaOrganizationPropertyRepository(
  prisma
);

const profanityChecker = LeoProfanityChecker.getInstance();
const ids = new CryptoIdGenerator();
const clock = new SystemClock();

// Use cases
const createPollUseCase = new CreatePollUseCase(
  pollRepository,
  boardRepository,
  organizationRepository,
  ids,
  clock,
  profanityChecker
);
const updatePollUseCase = new UpdatePollUseCase(
  pollRepository,
  voteRepository,
  userRepository,
  profanityChecker
);
const addQuestionUseCase = new AddQuestionUseCase(
  pollRepository,
  questionRepository,
  answerRepository,
  userRepository,
  ids,
  clock,
  profanityChecker
);
const updateQuestionUseCase = new UpdateQuestionUseCase(
  pollRepository,
  questionRepository,
  voteRepository,
  userRepository,
  profanityChecker
);
const deleteQuestionUseCase = new DeleteQuestionUseCase(
  pollRepository,
  questionRepository,
  voteRepository,
  userRepository,
  clock
);
const createAnswerUseCase = new CreateAnswerUseCase(
  pollRepository,
  questionRepository,
  answerRepository,
  voteRepository,
  userRepository,
  ids,
  clock,
  profanityChecker
);
const updateAnswerUseCase = new UpdateAnswerUseCase(
  pollRepository,
  questionRepository,
  answerRepository,
  voteRepository,
  userRepository,
  profanityChecker
);
const deleteAnswerUseCase = new DeleteAnswerUseCase(
  pollRepository,
  questionRepository,
  answerRepository,
  voteRepository,
  userRepository,
  clock
);
const updateQuestionOrderUseCase = new UpdateQuestionOrderUseCase(
  pollRepository,
  questionRepository,
  userRepository
);
const pollWeightCalculator = new PollWeightCalculator(
  organizationRepository,
  propertyAssetRepository
);
const takeSnapshotUseCase = new TakeSnapshotUseCase(
  pollRepository,
  participantRepository,
  boardRepository,
  organizationRepository,
  userRepository,
  pollEligibleMemberRepository,
  pollWeightCalculator,
  ids,
  clock
);
const activatePollUseCase = new ActivatePollUseCase(
  pollRepository,
  organizationRepository,
  userRepository,
  notificationRepository,
  participantRepository,
  boardRepository,
  ids,
  clock
);
const submitPollToAdminUseCase = new SubmitPollToAdminUseCase(
  pollRepository,
  organizationRepository,
  userRepository,
  notificationRepository,
  ids,
  clock
);
const returnPollToDraftUseCase = new ReturnPollToDraftUseCase(
  pollRepository,
  organizationRepository,
  userRepository,
  notificationRepository,
  ids,
  clock
);
const deactivatePollUseCase = new DeactivatePollUseCase(
  pollRepository,
  organizationRepository,
  userRepository,
  boardRepository
);
const discardSnapshotUseCase = new DiscardSnapshotUseCase(
  pollRepository,
  new PrismaPollSnapshotTransaction(prisma),
  organizationRepository,
  userRepository,
  boardRepository
);
const finishPollUseCase = new FinishPollUseCase(
  pollRepository,
  draftRepository,
  organizationRepository,
  userRepository,
  notificationRepository,
  participantRepository,
  boardRepository,
  ids,
  clock
);
const previewPollWeightConfigUseCase = new PreviewPollWeightConfigUseCase(
  pollRepository,
  participantRepository,
  userRepository,
  organizationRepository,
  pollEligibleMemberRepository,
  propertyAssetRepository,
  pollWeightCalculator
);
const updatePollWeightConfigUseCase = new UpdatePollWeightConfigUseCase(
  pollRepository,
  participantRepository,
  userRepository,
  organizationRepository,
  pollEligibleMemberRepository,
  propertyAssetRepository,
  organizationPropertyRepository,
  pollWeightCalculator,
  ids,
  clock
);

export async function createPollAction(
  formData: FormData
): Promise<ActionResult<{ pollId: PollId }>> {
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

    const input = readCreatePollForm(formData);

    // Validate with Zod
    const validation = createPollSchema(profanityChecker).safeParse(input);

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
    const result = await createPollUseCase.execute({
      ...validation.data,
      createdBy: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
): Promise<ActionResult<{ questionId: QuestionId }>> {
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

    // Parse FormData (same format as create page).
    const parsedInput = readQuestionForm(formData);

    // Validate with Zod
    const validation =
      addQuestionSchema(profanityChecker).safeParse(parsedInput);

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
    const result = await addQuestionUseCase.execute({
      ...validation.data,
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
    const validation = UpdateQuestionOrderSchema.safeParse(input);

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
    const result = await updateQuestionOrderUseCase.execute({
      ...validation.data,
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

export async function getUserPollsAction(): Promise<
  ActionResult<UserPollView[]>
> {
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

    const result = await pollRepository.getPollsByUserId(user.id);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    // For each poll, check if user can vote and voting progress
    const pollsWithVotingStatus = await Promise.all(
      result.value.map(async (poll) => {
        const pollJson = poll.toJSON();

        // Check if user can vote
        const participant = await prisma.pollParticipant.findFirst({
          where: {
            pollId: poll.id,
            userId: user.id,
          },
        });

        const canVote = !!participant;
        let hasFinishedVoting = false;

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

          const totalQuestions = pollJson.questions.length;
          hasFinishedVoting =
            votesCount >= totalQuestions && totalQuestions > 0;
        }

        return { ...pollJson, canVote, hasFinishedVoting };
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
  rawBoardId: string
): Promise<ActionResult<PollSnapshot[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = BoardId.safeParse(rawBoardId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const boardId = parsedId.data;

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

    // Check if user is a board member (superadmin can access any board)
    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

    if (!isSuperAdmin) {
      const isMember = await boardRepository.isUserMember(user.id, boardId);

      if (!isMember) {
        return {
          success: false,
          error: await translateErrorCode('board.errors.notMember'),
        };
      }
    }

    const result = await pollRepository.getPollsByBoardId(boardId);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
  rawPollId: string
): Promise<ActionResult<PollSnapshot>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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
      console.error(`getPollByIdAction error: ${result.error}`);

      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    if (!result.value) {
      return {
        success: false,
        error: await translateErrorCode('poll.errors.pollNotFound'),
      };
    }

    // Check if user is an org member (covers both board-specific and org-wide polls)
    // Superadmin can access any poll
    const poll = result.value;
    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

    // Open polls are distributed by link and voted on by outsiders, so any
    // authenticated user may read the poll itself. Who may read its *results*
    // is decided separately in GetPollResultsUseCase.
    if (!isSuperAdmin && !poll.isOpen()) {
      const isMember = await organizationRepository.isUserMember(
        user.id,
        poll.organizationId
      );
      const isAdmin = await organizationRepository.isUserAdmin(
        user.id,
        poll.organizationId
      );

      if (
        !PollReadPolicy.canViewPoll(poll, { isAdmin, isOrgMember: isMember })
      ) {
        return {
          success: false,
          error: await translateErrorCode('organization.errors.notMember'),
        };
      }
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

    const input = readUpdatePollForm(formData);

    // Validate with Zod
    const validation = updatePollSchema(profanityChecker).safeParse(input);

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
    const result = await updatePollUseCase.execute({
      ...validation.data,
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
  rawPollId: string
): Promise<
  ActionResult<{ canEdit: boolean; reason?: string; isCreator: boolean }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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

    // Check if user is creator or superadmin
    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);
    // Reported separately from canEdit: a submitted poll is uneditable by
    // everyone, but only its author may recall it, so the UI still has to tell
    // the two apart. A superadmin edits on the author's behalf and counts as
    // one here, matching SubmitPollToAdminUseCase.
    const isCreator = isSuperAdmin || poll.createdBy === user.id;

    if (!isCreator) {
      return {
        success: true,
        data: {
          canEdit: false,
          reason: 'notCreator',
          isCreator: false,
        },
      };
    }

    // Check if poll has votes
    const hasVotesResult = await voteRepository.pollHasVotes(pollId);

    if (!hasVotesResult.success) {
      return {
        success: false,
        error: await translateErrorCode(hasVotesResult.error),
      };
    }

    const hasVotes = hasVotesResult.value;

    // Check if poll can be edited
    const canEditResult = poll.canEdit(hasVotes);

    if (!canEditResult.success) {
      return {
        success: false,
        error: await translateErrorCode(canEditResult.error),
      };
    }

    if (!canEditResult.value) {
      let reason = 'unknown';

      if (poll.isSubmitted()) {
        reason = 'submitted';
      } else if (poll.isActive()) {
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
          isCreator,
        },
      };
    }

    return {
      success: true,
      data: {
        canEdit: true,
        isCreator,
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
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const validation = updateQuestionSchema(profanityChecker).safeParse(data);

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
        error: await translateErrorCode(result.error),
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
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

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
        error: await translateErrorCode(result.error),
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
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const validation = updateAnswerSchema(profanityChecker).safeParse(data);

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

    const result = await updateAnswerUseCase.execute({
      answerId: data.answerId,
      userId: user.id,
      text: data.text,
      order: data.order,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
}): Promise<ActionResult<{ answerId: AnswerId }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const validation = addAnswerSchema(profanityChecker).safeParse(data);

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

    const result = await createAnswerUseCase.execute({
      questionId: data.questionId,
      userId: user.id,
      text: data.text,
      order: data.order,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

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
        error: await translateErrorCode(result.error),
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
  rawPollId: string
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
 * Hand a draft to the organization's admins (DRAFT → SUBMITTED).
 * The author's call, so this is the one lifecycle action an admin cannot take.
 */
export async function submitPollToAdminAction(
  rawPollId: string
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await submitPollToAdminUseCase.execute({
      pollId,
      userId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error submitting poll to admin:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

/**
 * Send a submitted poll back for editing (SUBMITTED → DRAFT): the author
 * recalling it, or an admin returning it for changes.
 */
export async function returnPollToDraftAction(
  rawPollId: string
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await returnPollToDraftUseCase.execute({
      pollId,
      userId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error returning poll to draft:', error);

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
  rawPollId: string
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
  rawPollId: string
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
  rawPollId: string
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
  rawPollId: string
): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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
      return {
        success: false,
        error: await translateErrorCode(result.error),
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
  rawPollId: string
): Promise<ActionResult<boolean>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const parsedId = PollId.safeParse(rawPollId);

  if (!parsedId.success) {
    return {
      success: false,
      error: await translateErrorCode('common.errors.validationFailed'),
    };
  }

  const pollId = parsedId.data;

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
      return {
        success: false,
        error: await translateErrorCode('poll.errors.pollNotFound'),
      };
    }

    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

    if (isSuperAdmin) {
      return { success: true, data: true };
    }

    const isOrgAdmin = await organizationRepository.isUserAdmin(
      user.id,
      poll.organizationId
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

export interface SearchPollsInput {
  titleSearch?: string;
  statuses?: PollState[];
  organizationId?: string;
  boardId?: string;
  orgWideOnly?: boolean;
  createdFrom?: string;
  createdTo?: string;
  startFrom?: string;
  startTo?: string;
  page?: number;
  pageSize?: number;
}

export async function searchPollsAction(
  input: SearchPollsInput
): Promise<ActionResult<PollSearchView>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

    const filters: PollSearchFilters = {
      titleSearch: input.titleSearch || undefined,
      statuses: input.statuses,
      organizationId: input.organizationId
        ? OrganizationId.parse(input.organizationId)
        : undefined,
      boardId: input.boardId ? BoardId.parse(input.boardId) : undefined,
      orgWideOnly: input.orgWideOnly,
      createdFrom: input.createdFrom
        ? Instant.fromDate(new Date(input.createdFrom))
        : undefined,
      createdTo: input.createdTo
        ? Instant.fromDate(new Date(input.createdTo))
        : undefined,
      startFrom: input.startFrom
        ? Instant.fromDate(new Date(input.startFrom))
        : undefined,
      startTo: input.startTo
        ? Instant.fromDate(new Date(input.startTo))
        : undefined,
      page: input.page === undefined ? undefined : PageNumber.parse(input.page),
      pageSize:
        input.pageSize === undefined
          ? undefined
          : PageSize.parse(input.pageSize),
    };

    // Admin org IDs so admins see their orgs' polls even if not a member
    let adminOrgIds: OrganizationId[] | undefined;

    if (!isSuperAdmin) {
      const adminOrgs =
        await organizationRepository.findAdminOrganizationsByUserId(user.id);
      adminOrgIds = adminOrgs.map((o) => o.id);
    }

    const result = await pollRepository.searchPolls(
      filters,
      isSuperAdmin ? undefined : user.id,
      adminOrgIds
    );

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    // Enrich with canVote + hasFinishedVoting + org/board names
    const enriched = await Promise.all(
      result.value.polls.map(async (poll) => {
        const pollJson = poll.toJSON();

        // Org + board names
        const org = await prisma.organization.findUnique({
          where: { id: poll.organizationId },
          select: { name: true, archivedAt: true },
        });
        const board = poll.boardId
          ? await prisma.board.findUnique({
              where: { id: poll.boardId },
              select: { name: true, archivedAt: true },
            })
          : null;

        // canVote + hasFinishedVoting. An open poll has no participants until
        // people vote, so eligibility there is "authenticated and not done
        // yet" — otherwise even the org's own members would see no way in.
        const participant = await prisma.pollParticipant.findFirst({
          where: { pollId: poll.id, userId: user.id },
        });

        const votesCount = await prisma.vote.count({
          where: {
            userId: user.id,
            question: { pollId: poll.id },
          },
        });
        const totalQuestions = pollJson.questions.length;

        const hasFinishedVoting =
          votesCount >= totalQuestions && totalQuestions > 0;
        const canVote = pollJson.pollType === 'OPEN' || !!participant;

        return {
          ...pollJson,
          organizationName: org?.name ?? '',
          isOrgArchived: !!org?.archivedAt,
          boardName: board?.name ?? '',
          isBoardArchived: !!board?.archivedAt,
          canVote,
          hasFinishedVoting,
        };
      })
    );

    return {
      success: true,
      data: { polls: enriched, totalCount: result.value.totalCount },
    };
  } catch (error) {
    console.error('Error searching polls:', error);

    return { success: false, error: t('generic') };
  }
}

export async function previewPollWeightConfigAction(args: {
  pollId: string;
  distributionType?: string;
  propertyAggregation?: string;
  propertyIds?: string[];
}): Promise<
  ActionResult<
    import('@/application/poll/PreviewPollWeightConfigUseCase').PreviewPollWeightConfigOutput
  >
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: await translateErrorCode('auth.errors.unauthorized'),
    };
  }

  const result = await previewPollWeightConfigUseCase.execute({
    pollId: args.pollId,
    newConfig: {
      distributionType: args.distributionType,
      propertyAggregation: args.propertyAggregation,
      propertyIds: args.propertyIds,
    },
    actingUserId: user.id,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: result.value };
}

export async function updatePollWeightConfigAction(args: {
  pollId: string;
  distributionType?: string;
  propertyAggregation?: string;
  propertyIds?: string[];
}): Promise<ActionResult<void>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const user = await getCurrentUser();

  if (!user) {
    return {
      success: false,
      error: await translateErrorCode('auth.errors.unauthorized'),
    };
  }

  const result = await updatePollWeightConfigUseCase.execute({
    pollId: args.pollId,
    newConfig: {
      distributionType: args.distributionType,
      propertyAggregation: args.propertyAggregation,
      propertyIds: args.propertyIds,
    },
    adminUserId: user.id,
  });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  return { success: true, data: undefined };
}
