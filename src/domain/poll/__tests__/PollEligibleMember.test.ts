import { describe, it, expect } from 'vitest';
import { PollEligibleMember } from '../PollEligibleMember';

describe('PollEligibleMember', () => {
  it('creates with poll, user, and snapshotAt', () => {
    const at = new Date('2026-04-01');
    const m = PollEligibleMember.create('poll-1', 'user-1', at);
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
