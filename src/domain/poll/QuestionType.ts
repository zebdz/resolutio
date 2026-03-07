export const QUESTION_TYPES = ['single-choice', 'multiple-choice'] as const;

export type QuestionType = (typeof QUESTION_TYPES)[number];

export function isValidQuestionType(type: string): type is QuestionType {
  return QUESTION_TYPES.includes(type as QuestionType);
}
