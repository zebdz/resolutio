import { z } from 'zod';

export const CreatePollSchema = z
  .object({
    title: z
      .string()
      .min(1, 'Poll title is required')
      .max(500, 'Poll title is too long'),
    description: z
      .string()
      .min(1, 'Poll description is required')
      .max(5000, 'Poll description is too long'),
    boardId: z.string().min(1, 'Board ID is required'),
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
    .max(1000, 'Question text is too long'),
  details: z.string().max(5000, 'Question details are too long').optional(),
  page: z.coerce.number().min(1, 'Page must be at least 1'),
  order: z.coerce.number().min(0, 'Order must be non-negative'),
  questionType: z.enum(['single-choice', 'multiple-choice']),
  answers: z
    .array(z.string().min(1, 'Answer text cannot be empty'))
    .min(1, 'At least one answer is required'),
});

export const UpdateQuestionSchema = z.object({
  questionId: z.string().min(1, 'Question ID is required'),
  text: z
    .string()
    .min(1, 'Question text is required')
    .max(1000, 'Question text is too long')
    .optional(),
  details: z
    .string()
    .max(5000, 'Question details are too long')
    .optional()
    .nullable(),
  questionType: z.enum(['single-choice', 'multiple-choice']).optional(),
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
    .max(1000, 'Answer text is too long'),
  order: z.coerce.number().min(0, 'Order must be non-negative'),
});

export const UpdateAnswerSchema = z.object({
  answerId: z.string().min(1, 'Answer ID is required'),
  text: z
    .string()
    .min(1, 'Answer text is required')
    .max(1000, 'Answer text is too long')
    .optional(),
  order: z.coerce.number().min(0, 'Order must be non-negative').optional(),
});

export const DeleteAnswerSchema = z.object({
  answerId: z.string().min(1, 'Answer ID is required'),
});
