/** Request validation for poll editing. Validated positions retain domain units;
 * the use cases enforce lifecycle, ownership and normalized-content invariants. */
import { z } from 'zod';
import { PageNumber, SortOrder } from '../../domain/poll/QuestionValues';
import {
  POLL_TITLE_MAX_LENGTH,
  POLL_DESCRIPTION_MAX_LENGTH,
} from '../../domain/poll/Poll';
import {
  QUESTION_TEXT_MAX_LENGTH,
  QUESTION_DETAILS_MAX_LENGTH,
} from '../../domain/poll/Question';
import { ANSWER_TEXT_MAX_LENGTH } from '../../domain/poll/Answer';
import { QUESTION_TYPES } from '../../domain/poll/QuestionType';
import {
  PollDomainCodes,
  PollDomainCode,
} from '../../domain/poll/PollDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

function positionInput<T>(schema: z.ZodType<T>, code: PollDomainCode) {
  return z.unknown().transform((value, ctx) => {
    // Numeric text is supported; booleans and missing/blank inputs are not positions.
    const parsed = schema.safeParse(
      typeof value === 'string' && value.trim() ? Number(value) : value
    );

    if (!parsed.success) {
      ctx.addIssue({ code: 'custom', message: code });

      return z.NEVER;
    }

    return parsed.data;
  });
}

const questionPage = positionInput(
  PageNumber,
  PollDomainCodes.QUESTION_INVALID_PAGE
);
const questionOrder = positionInput(
  SortOrder,
  PollDomainCodes.QUESTION_INVALID_ORDER
);
const answerOrder = positionInput(
  SortOrder,
  PollDomainCodes.ANSWER_INVALID_ORDER
);

export const createPollSchema = (profanityChecker: ProfanityChecker) =>
  z
    .object({
      title: z
        .string()
        .min(1, PollDomainCodes.POLL_TITLE_EMPTY)
        .max(POLL_TITLE_MAX_LENGTH, PollDomainCodes.POLL_TITLE_TOO_LONG)
        .refine((val) => !profanityChecker.containsProfanity(val), {
          message: SharedDomainCodes.CONTAINS_PROFANITY,
        }),
      description: z
        .string()
        .min(1, PollDomainCodes.POLL_DESCRIPTION_EMPTY)
        .max(
          POLL_DESCRIPTION_MAX_LENGTH,
          PollDomainCodes.POLL_DESCRIPTION_TOO_LONG
        )
        .refine((val) => !profanityChecker.containsProfanity(val), {
          message: SharedDomainCodes.CONTAINS_PROFANITY,
        }),
      organizationId: z.string().min(1, 'Organization ID is required'),
      boardId: z.string().nullable().default(null),
      startDate: z.coerce.date({ error: PollDomainCodes.POLL_INVALID_DATES }),
      endDate: z.coerce.date({ error: PollDomainCodes.POLL_INVALID_DATES }),
      distributionType: z
        .enum(['EQUAL', 'OWNERSHIP_UNIT_COUNT', 'OWNERSHIP_SIZE_WEIGHTED'])
        .optional(),
      propertyAggregation: z
        .enum(['RAW_SUM', 'NORMALIZE_PER_PROPERTY'])
        .optional(),
      propertyIds: z
        .array(z.string({ error: PollDomainCodes.PROPERTY_NOT_IN_ORG }), {
          error: PollDomainCodes.PROPERTY_NOT_IN_ORG,
        })
        .optional(),
      pollType: z.enum(['ORGANIZATION', 'OPEN']).optional(),
      // Named is the default. Deliberately absent from updatePollSchema: the
      // flag is set once at creation and never changes.
      anonymous: z.coerce.boolean().default(false),
    })
    .refine((data) => data.startDate < data.endDate, {
      message: 'Start date must be before end date',
      path: ['endDate'],
    })
    // An open poll is voted on by the whole platform, so it cannot also be
    // narrowed to one governing body.
    .refine((data) => !(data.pollType === 'OPEN' && data.boardId !== null), {
      message: PollDomainCodes.POLL_OPEN_CANNOT_BE_BOARD_SCOPED,
      path: ['boardId'],
    });

export type CreatePollInput = z.input<ReturnType<typeof createPollSchema>>;

export const updatePollSchema = (profanityChecker: ProfanityChecker) =>
  z
    .object({
      pollId: z.string().min(1, 'Poll ID is required'),
      title: z
        .string()
        .min(1, PollDomainCodes.POLL_TITLE_EMPTY)
        .max(POLL_TITLE_MAX_LENGTH, PollDomainCodes.POLL_TITLE_TOO_LONG)
        .refine((val) => !profanityChecker.containsProfanity(val), {
          message: SharedDomainCodes.CONTAINS_PROFANITY,
        }),
      description: z
        .string()
        .min(1, PollDomainCodes.POLL_DESCRIPTION_EMPTY)
        .max(
          POLL_DESCRIPTION_MAX_LENGTH,
          PollDomainCodes.POLL_DESCRIPTION_TOO_LONG
        )
        .refine((val) => !profanityChecker.containsProfanity(val), {
          message: SharedDomainCodes.CONTAINS_PROFANITY,
        }),
      startDate: z.coerce.date({ error: PollDomainCodes.POLL_INVALID_DATES }),
      endDate: z.coerce.date({ error: PollDomainCodes.POLL_INVALID_DATES }),
    })
    .refine((data) => data.startDate < data.endDate, {
      message: 'Start date must be before end date',
      path: ['endDate'],
    });

export type UpdatePollInput = z.input<ReturnType<typeof updatePollSchema>>;

export const addQuestionSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    pollId: z.string().min(1, 'Poll ID is required'),
    text: z
      .string()
      .min(1, PollDomainCodes.QUESTION_TEXT_EMPTY)
      .max(QUESTION_TEXT_MAX_LENGTH, PollDomainCodes.QUESTION_TEXT_TOO_LONG)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    details: z
      .string({ error: PollDomainCodes.QUESTION_INVALID_DATA })
      .max(
        QUESTION_DETAILS_MAX_LENGTH,
        PollDomainCodes.QUESTION_DETAILS_TOO_LONG
      )
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    page: questionPage,
    order: questionOrder,
    questionType: z.enum(QUESTION_TYPES),
    answers: z
      .array(
        z
          .string()
          .min(1, PollDomainCodes.ANSWER_TEXT_EMPTY)
          .refine((val) => !profanityChecker.containsProfanity(val), {
            message: SharedDomainCodes.CONTAINS_PROFANITY,
          })
      )
      .min(1, 'At least one answer is required'),
  });

export type AddQuestionInput = z.input<ReturnType<typeof addQuestionSchema>>;

export const updateQuestionSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    questionId: z.string().min(1, 'Question ID is required'),
    text: z
      .string()
      .min(1, PollDomainCodes.QUESTION_TEXT_EMPTY)
      .max(QUESTION_TEXT_MAX_LENGTH, PollDomainCodes.QUESTION_TEXT_TOO_LONG)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    details: z
      .string({ error: PollDomainCodes.QUESTION_INVALID_DATA })
      .max(
        QUESTION_DETAILS_MAX_LENGTH,
        PollDomainCodes.QUESTION_DETAILS_TOO_LONG
      )
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional()
      .nullable(),
    questionType: z.enum(QUESTION_TYPES).optional(),
  });

export type UpdateQuestionInput = z.input<
  ReturnType<typeof updateQuestionSchema>
>;

export const DeleteQuestionSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
});

export const UpdateQuestionOrderSchema = z.object({
  pollId: z.string().min(1, 'Poll ID is required'),
  updates: z
    .array(
      z.object({
        questionId: z.string().min(1, 'Question ID is required'),
        page: questionPage,
        order: questionOrder,
      })
    )
    .min(1, 'At least one update is required'),
});

export const addAnswerSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    questionId: z.string().min(1, 'Question ID is required'),
    text: z
      .string()
      .min(1, PollDomainCodes.ANSWER_TEXT_EMPTY)
      .max(ANSWER_TEXT_MAX_LENGTH, PollDomainCodes.ANSWER_TEXT_TOO_LONG)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      }),
    order: answerOrder,
  });

export type AddAnswerInput = z.input<ReturnType<typeof addAnswerSchema>>;

export const updateAnswerSchema = (profanityChecker: ProfanityChecker) =>
  z.object({
    answerId: z.string().min(1, 'Answer ID is required'),
    text: z
      .string()
      .min(1, PollDomainCodes.ANSWER_TEXT_EMPTY)
      .max(ANSWER_TEXT_MAX_LENGTH, PollDomainCodes.ANSWER_TEXT_TOO_LONG)
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    order: answerOrder.optional(),
  });

export type UpdateAnswerInput = z.input<ReturnType<typeof updateAnswerSchema>>;

export const DeleteAnswerSchema = z.object({
  answerId: z.string().min(1, 'Answer ID is required'),
});
