/** The reviewed source plus its account crosswalk supplies native question, answer and vote IDs. */
import { expect, it } from 'vitest';
import { nativeBallots } from './native-import.mjs';
import { historyKey } from './content.mjs';

it('maps only meeting questions and their ballots directly from the package, with an import-time fallback', () => {
  const data = {
    assets: [],
    rows: {
      questions: [
        { id: 4, poll_id: 1, text: 'Question', position_in_poll: 3 },
        { id: 5, poll_id: 2, text: 'Work report' },
      ],
      answers: [
        { id: 6, question_id: 4, text: 'Yes' },
        { id: 7, question_id: 5, text: '2' },
      ],
      votes: [
        { id: 8, question_id: 4, answer_id: 6, user_id: 3 },
        { id: 9, question_id: 5, answer_id: 7, user_id: 3 },
      ],
    },
  };
  const now = new Date('2026-11-22T12:00:00Z');
  const result = nativeBallots(data, new Map([[1, 'native-poll']]), now);
  const question = historyKey('question', 4).slice(5);
  expect(result.questions).toMatchObject([
    { id: question, poll_id: 'native-poll', title: 'Question' },
  ]);
  expect(result.answers).toMatchObject([
    { id: historyKey('answer', 6).slice(5), question_id: question },
  ]);
  expect(result.votes).toMatchObject([
    {
      id: historyKey('vote', 8).slice(5),
      question_id: question,
      legacy_user: 3,
      cast_at: now.toISOString(),
    },
  ]);
});
