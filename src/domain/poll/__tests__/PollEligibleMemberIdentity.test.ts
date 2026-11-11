/** Eligibility snapshots retain their assigned identity and immutable capture time.
 * Database records must pass the same identity validation as new snapshots. */
import { expect, it } from 'vitest';
import { PollEligibleMember } from '../PollEligibleMember';
import { PollEligibleMemberId, PollId, UserId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';

it('retains caller identity and detaches snapshot timestamps', () => {
  const creation = testCreation(PollEligibleMemberId, 'eligible-1');
  const member = PollEligibleMember.create(
    PollId.parse('poll-1'),
    UserId.parse('user-1'),
    creation
  );
  expect(member.id).toBe(creation.id);
  expect(member.snapshotAt.toISOString()).toBe(creation.now);
  member.snapshotAt.setFullYear(2000);
  expect(member.snapshotAt.toISOString()).toBe(creation.now);
});
