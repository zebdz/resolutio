import { z } from 'zod';
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
import { PollDomainCodes } from '../../domain/poll/PollDomainCodes';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

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
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
    })
    .refine((data) => data.startDate < data.endDate, {
      message: 'Start date must be before end date',
      path: ['endDate'],
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
      startDate: z.coerce.date(),
      endDate: z.coerce.date(),
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
      .string()
      .max(
        QUESTION_DETAILS_MAX_LENGTH,
        PollDomainCodes.QUESTION_DETAILS_TOO_LONG
      )
      .refine((val) => !profanityChecker.containsProfanity(val), {
        message: SharedDomainCodes.CONTAINS_PROFANITY,
      })
      .optional(),
    page: z.coerce.number().min(1, 'Page must be at least 1'),
    order: z.coerce.number().min(0, 'Order must be non-negative'),
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
      .string()
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
        page: z.coerce.number().min(1, 'Page must be at least 1'),
        order: z.coerce.number().min(0, 'Order must be non-negative'),
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
    order: z.coerce.number().min(0, 'Order must be non-negative'),
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
    order: z.coerce.number().min(0, 'Order must be non-negative').optional(),
  });

export type UpdateAnswerInput = z.input<ReturnType<typeof updateAnswerSchema>>;

export const DeleteAnswerSchema = z.object({
  answerId: z.string().min(1, 'Answer ID is required'),
});
