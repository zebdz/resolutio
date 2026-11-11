/** Runtime contracts for poll-owned identifiers, exact weights and instants.
 * Invalid boundary values must fail before becoming trusted domain facts. */
import { expect, it } from 'vitest';
import {
  PollId,
  UserId,
  QuestionId,
  AnswerId,
  ParticipantId,
  PollInstant,
} from '../PollValues';

it('accepts existing opaque IDs and rejects missing or malformed identifiers', () => {
  for (const type of [PollId, UserId, QuestionId, AnswerId, ParticipantId]) {
    expect(type.parse('cuid_1-ABC')).toBe('cuid_1-ABC');

    for (const value of ['', 'bad id', 'id:other', 'x'.repeat(257)]) {
      expect(type.safeParse(value).success).toBe(false);
    }
  }
});

it('requires an actual canonical UTC instant with millisecond precision', () => {
  expect(PollInstant.parse('2026-10-26T10:00:00.123Z')).toBe(
    '2026-10-26T10:00:00.123Z'
  );

  for (const value of [
    'invalid',
    '2026-02-30T10:00:00.000Z',
    '2026-10-26',
    '2026-10-26T10:00:00Z',
    '2026-10-26T10:00:00.000+03:00',
  ]) {
    expect(PollInstant.safeParse(value).success).toBe(false);
  }
});
