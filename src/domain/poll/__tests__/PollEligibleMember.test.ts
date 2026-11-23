/** Eligibility snapshots retain caller-assigned identity and immutable snapshot time. */
import { describe, it, expect } from 'vitest';
import { PollEligibleMember } from '../PollEligibleMember';
import { PollEligibleMemberId, PollId, UserId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';

describe('PollEligibleMember', () => {
  it('creates with poll, user, and snapshotAt', () => {
    const at = new Date('2026-04-01');
    const m = PollEligibleMember.create(
      PollId.parse('poll-1'),
      UserId.parse('user-1'),
      {
        id: PollEligibleMemberId.parse('eligible-1'),
        now: Instant.fromDate(at),
      }
    );
    expect(m.id).toBe('eligible-1');
    expect(m.pollId).toBe('poll-1');
    expect(m.userId).toBe('user-1');
    expect(m.snapshotAt).toEqual(at);
  });

  it('reconstitutes with id', () => {
    const at = new Date('2026-04-01');
    const m = PollEligibleMember.reconstitute({
      id: 'x',
      pollId: 'poll-1',
      userId: 'user-1',
      snapshotAt: at,
      createdAt: new Date(),
    });
    expect(m.id).toBe('x');
  });
});
