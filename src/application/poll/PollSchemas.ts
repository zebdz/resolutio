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

export const CreatePollSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Poll title is required')
      .max(POLL_TITLE_MAX_LENGTH, 'Poll title is too long'),
    description: z
      .string()
      .min(1, 'Poll description is required')
      .max(POLL_DESCRIPTION_MAX_LENGTH, 'Poll description is too long'),
    organizationId: z.string().min(1, 'Organization ID is required'),
    boardId: z.string().nullable().default(null),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: 'Start date must be before end date',
    path: ['endDate'],
  });

export const UpdatePollSchema = z
  .object({
    pollId: z.string().min(1, 'Poll ID is required'),
    title: z
      .string()
      .min(1, 'Poll title is required')
      .max(POLL_TITLE_MAX_LENGTH, 'Poll title is too long'),
    description: z
      .string()
      .min(1, 'Poll description is required')
      .max(POLL_DESCRIPTION_MAX_LENGTH, 'Poll description is too long'),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
  })
  .refine((data) => data.startDate < data.endDate, {
    message: 'Start date must be before end date',
    path: ['endDate'],
  });

export const AddQuestionSchema = z.object({
  pollId: z.string().min(1, 'Poll ID is required'),
  text: z
    .string()
    .min(1, 'Question text is required')
    .max(QUESTION_TEXT_MAX_LENGTH, 'Question text is too long'),
  details: z
    .string()
    .max(QUESTION_DETAILS_MAX_LENGTH, 'Question details are too long')
    .optional(),
  page: z.coerce.number().min(1, 'Page must be at least 1'),
  order: z.coerce.number().min(0, 'Order must be non-negative'),
  questionType: z.enum(QUESTION_TYPES),
  answers: z
    .array(z.string().min(1, 'Answer text cannot be empty'))
    .min(1, 'At least one answer is required'),
});

export const UpdateQuestionSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  text: z
    .string()
    .min(1, 'Question text is required')
    .max(QUESTION_TEXT_MAX_LENGTH, 'Question text is too long')
    .optional(),
  details: z
    .string()
    .max(QUESTION_DETAILS_MAX_LENGTH, 'Question details are too long')
    .optional()
    .nullable(),
  questionType: z.enum(QUESTION_TYPES).optional(),
});

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

export const AddAnswerSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  text: z
    .string()
    .min(1, 'Answer text is required')
    .max(ANSWER_TEXT_MAX_LENGTH, 'Answer text is too long'),
  order: z.coerce.number().min(0, 'Order must be non-negative'),
});

export const UpdateAnswerSchema = z.object({
  answerId: z.string().min(1, 'Answer ID is required'),
  text: z
    .string()
    .min(1, 'Answer text is required')
    .max(ANSWER_TEXT_MAX_LENGTH, 'Answer text is too long')
    .optional(),
  order: z.coerce.number().min(0, 'Order must be non-negative').optional(),
});

export const DeleteAnswerSchema = z.object({
  answerId: z.string().min(1, 'Answer ID is required'),
});
