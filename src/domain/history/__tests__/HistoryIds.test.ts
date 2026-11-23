/** Route keys preserve distinct poll, question and owned-asset identity contracts. */
import { it, expect } from 'vitest';
import {
  HistoricalPollId,
  HistoricalQuestionId,
  HistoricalAssetKey,
} from '../HistoryIds';

it('accepts only canonical ids and owned asset references', () => {
  const poll = HistoricalPollId.parse('hist_' + 'a'.repeat(32));
  const question = HistoricalQuestionId.parse('hist_' + 'b'.repeat(32));
  // @ts-expect-error Question and poll identities are distinct domains.
  const wrong: HistoricalPollId = question;
  expect(wrong).toBe('hist_' + 'b'.repeat(32));
  expect(poll).toBe('hist_' + 'a'.repeat(32));

  for (const key of ['00', '-1', '1/2', '1e8', '999999999999']) {
    expect(HistoricalPollId.safeParse(key).success).toBe(false);
    expect(HistoricalQuestionId.safeParse(key).success).toBe(false);
  }

  expect(HistoricalAssetKey.safeParse('hist_' + 'c'.repeat(32)).success).toBe(
    true
  );
  expect(
    HistoricalAssetKey.safeParse('unassigned-67-deadbeefdeadbeef').success
  ).toBe(false);
});
