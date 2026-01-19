'use client';

import { Radio, RadioGroup, RadioField } from '@/app/components/catalyst/radio';
import { Checkbox, CheckboxField } from '@/app/components/catalyst/checkbox';
import { Label } from '@/app/components/catalyst/fieldset';

interface Answer {
  id: string;
  text: string;
  order: number;
}

interface Question {
  id: string;
  text: string;
  details: string | null;
  questionType: 'single-choice' | 'multiple-choice';
  answers: Answer[];
}

interface VotingQuestionProps {
  question: Question;
  selectedAnswers: string[];
  onAnswerSelect: (answerId: string) => void;
  disabled?: boolean;
}

export default function VotingQuestion({
  question,
  selectedAnswers,
  onAnswerSelect,
  disabled = false,
}: VotingQuestionProps) {
  const sortedAnswers = [...question.answers].sort((a, b) => a.order - b.order);

  if (question.questionType === 'single-choice') {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
            {question.text}
          </h3>
          {question.details && (
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {question.details}
            </p>
          )}
        </div>

        <RadioGroup
          value={selectedAnswers[0] || ''}
          onChange={onAnswerSelect}
          disabled={disabled}
        >
          <div className="space-y-3">
            {sortedAnswers.map((answer) => (
              <RadioField key={answer.id}>
                <Radio value={answer.id} />
                <Label className="text-sm text-zinc-900 dark:text-white">
                  {answer.text}
                </Label>
              </RadioField>
            ))}
          </div>
        </RadioGroup>
      </div>
    );
  }

  // Multiple choice
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900">
      <div className="mb-4">
        <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
          {question.text}
        </h3>
        {question.details && (
          <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
            {question.details}
          </p>
        )}
      </div>

      <div className="space-y-3">
        {sortedAnswers.map((answer) => (
          <CheckboxField key={answer.id}>
            <Checkbox
              checked={selectedAnswers.includes(answer.id)}
              onChange={() => onAnswerSelect(answer.id)}
              disabled={disabled}
            />
            <Label className="text-sm text-zinc-900 dark:text-white">
              {answer.text}
            </Label>
          </CheckboxField>
        ))}
      </div>
    </div>
  );
}
