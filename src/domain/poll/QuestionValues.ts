/** Validated positions and canonical text for poll questions and their choices.
 * Stored values cannot contain fractional positions or bypass text constraints. */
import { z } from 'zod';
import { Result, success, failure } from '../shared/Result';
import { PollDomainCodes as Codes, PollDomainCode } from './PollDomainCodes';

export const SortOrder = z
  .number()
  .int()
  .nonnegative()
  .brand<'PollSortOrder'>();
export type SortOrder = z.infer<typeof SortOrder>;

export const ANSWER_TEXT_MAX_LENGTH = 500;
export const AnswerText = z
  .string()
  .min(1)
  .max(ANSWER_TEXT_MAX_LENGTH)
  .refine((value) => value === value.trim())
  .brand<'AnswerText'>();
export type AnswerText = z.infer<typeof AnswerText>;

export const PageNumber = z.number().int().min(1).brand<'PollPageNumber'>();
export type PageNumber = z.infer<typeof PageNumber>;

export const QUESTION_TEXT_MAX_LENGTH = 500;
export const QUESTION_DETAILS_MAX_LENGTH = 500;
export const QuestionText = z
  .string()
  .min(1)
  .max(QUESTION_TEXT_MAX_LENGTH)
  .refine((value) => value === value.trim())
  .brand<'QuestionText'>();
export type QuestionText = z.infer<typeof QuestionText>;
export const QuestionDetails = z
  .string()
  .min(1)
  .max(QUESTION_DETAILS_MAX_LENGTH)
  .refine((value) => value === value.trim())
  .brand<'QuestionDetails'>();
export type QuestionDetails = z.infer<typeof QuestionDetails>;

/** Request decoders normalize input; persisted values use the strict schemas above. */
export function parseAnswerText(
  value: unknown
): Result<AnswerText, PollDomainCode> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(Codes.ANSWER_TEXT_EMPTY);
  }

  if (value.length > ANSWER_TEXT_MAX_LENGTH) {
    return failure(Codes.ANSWER_TEXT_TOO_LONG);
  }

  return success(AnswerText.parse(value.trim()));
}

export function parseQuestionText(
  value: unknown
): Result<QuestionText, PollDomainCode> {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return failure(Codes.QUESTION_TEXT_EMPTY);
  }

  if (value.length > QUESTION_TEXT_MAX_LENGTH) {
    return failure(Codes.QUESTION_TEXT_TOO_LONG);
  }

  return success(QuestionText.parse(value.trim()));
}

export function parseQuestionDetails(
  value: unknown
): Result<QuestionDetails | null, PollDomainCode> {
  if (value === null || value === undefined) {
    return success(null);
  }

  if (typeof value !== 'string') {
    return failure(Codes.QUESTION_INVALID_DATA);
  }

  if (value.length > QUESTION_DETAILS_MAX_LENGTH) {
    return failure(Codes.QUESTION_DETAILS_TOO_LONG);
  }

  return success(value.trim() ? QuestionDetails.parse(value.trim()) : null);
}

/** Number of questions in a poll, distinct from positions and selected answers. */
export const QuestionCount = z
  .number()
  .int()
  .nonnegative()
  .brand<'QuestionCount'>();
export type QuestionCount = z.infer<typeof QuestionCount>;
