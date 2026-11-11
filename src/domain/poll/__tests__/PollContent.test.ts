/** Poll author input is decoded before invoking typed content mutations.
 * Pre-trim length errors and normalized stored text remain unchanged. */
import { expect, it } from 'vitest';
import {
  parsePollTitle,
  parsePollDescription,
  parseNewPollContent,
} from '../PollContent';
import { PollDomainCodes as Codes } from '../PollDomainCodes';

it('decodes titles and descriptions without weakening existing limits', () => {
  expect(parsePollTitle(' Title ')).toEqual({ success: true, value: 'Title' });
  expect(parsePollDescription(' Description ')).toEqual({
    success: true,
    value: 'Description',
  });
  expect(parsePollTitle(' ')).toEqual({
    success: false,
    error: Codes.POLL_TITLE_EMPTY,
  });
  expect(parsePollDescription(' ')).toEqual({
    success: false,
    error: Codes.POLL_DESCRIPTION_EMPTY,
  });
  expect(parsePollTitle(' ' + 'x'.repeat(500))).toEqual({
    success: false,
    error: Codes.POLL_TITLE_TOO_LONG,
  });
  expect(parsePollDescription(' ' + 'x'.repeat(10000))).toEqual({
    success: false,
    error: Codes.POLL_DESCRIPTION_TOO_LONG,
  });
});

it('validates new-poll content in order and rejects attachment references before creation', () => {
  const foreign = '![Evidence](/api/poll-attachments/foreign)';
  expect(parseNewPollContent(' ', foreign)).toEqual({
    success: false,
    error: Codes.POLL_TITLE_EMPTY,
  });
  expect(parseNewPollContent('Title', foreign)).toEqual({
    success: false,
    error: Codes.POLL_DESCRIPTION_INVALID_ATTACHMENT_REF,
  });
  expect(parseNewPollContent(' Title ', ' Description ')).toEqual({
    success: true,
    value: { title: 'Title', description: 'Description' },
  });
});
