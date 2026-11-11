/** Request content decoding preserves normalization and localized failure codes.
 * The aggregate receives distinct validated values; storage decoding stays strict. */
import { expect, it } from 'vitest';
import {
  parseAnswerText,
  parseQuestionText,
  parseQuestionDetails,
} from '../QuestionValues';
import { PollDomainCodes as Codes } from '../PollDomainCodes';

it('normalizes request content and represents absent details explicitly', () => {
  expect(parseQuestionText('  Choose  ')).toEqual({
    success: true,
    value: 'Choose',
  });
  expect(parseAnswerText('  Yes  ')).toEqual({ success: true, value: 'Yes' });
  expect(parseQuestionDetails(' Details ')).toEqual({
    success: true,
    value: 'Details',
  });

  for (const input of [undefined, null, '', '   ']) {
    expect(parseQuestionDetails(input)).toEqual({ success: true, value: null });
  }

  expect(parseQuestionText(' ')).toEqual({
    success: false,
    error: Codes.QUESTION_TEXT_EMPTY,
  });
  expect(parseAnswerText(' ')).toEqual({
    success: false,
    error: Codes.ANSWER_TEXT_EMPTY,
  });
  // Length is checked before trimming, retaining the existing request constraint.
  expect(parseQuestionText(' ' + 'x'.repeat(500))).toEqual({
    success: false,
    error: Codes.QUESTION_TEXT_TOO_LONG,
  });
  expect(parseAnswerText(' ' + 'x'.repeat(500))).toEqual({
    success: false,
    error: Codes.ANSWER_TEXT_TOO_LONG,
  });
  expect(parseQuestionDetails(' ' + 'x'.repeat(500))).toEqual({
    success: false,
    error: Codes.QUESTION_DETAILS_TOO_LONG,
  });
});
