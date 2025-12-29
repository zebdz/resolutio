export type QuestionType = 'single-choice' | 'multiple-choice';

export const QUESTION_TYPES: QuestionType[] = [
  'single-choice',
  'multiple-choice',
];

export function isValidQuestionType(type: string): type is QuestionType {
  return QUESTION_TYPES.includes(type as QuestionType);
}
