/** Native administrator decisions legitimately amend the electorate after the initial import. */
import { expect, it } from 'vitest';
import { electorateMatches } from './verify.mjs';

it('reconciles the source roster with audited changes and detects unexplained changes', () => {
  const initial = new Map([
    ['a', true],
    ['b', false],
  ]);
  const changes = [
    { member_id: 'a', was_eligible: true, eligible: false },
    { member_id: 'b', was_eligible: false, eligible: true },
  ];
  const actual = [
    { user_id: 'a', voting_eligible: false },
    { user_id: 'b', voting_eligible: true },
  ];
  expect(electorateMatches(initial, changes, actual)).toBe(true);
  expect(electorateMatches(initial, changes.slice(1), actual)).toBe(false);
});
