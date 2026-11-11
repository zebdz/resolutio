/** Participant lists may include identities and weights, never ballot credentials.
 * Check actual serialized output because TypeScript private fields exist at runtime. */
import { UserId } from '@/domain/shared/EntityIds';
import { FirstName, LastName } from '@/domain/user/UserValues';
import { expect, it } from 'vitest';
import { serializeParticipants } from '../serializeParticipants';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';

it('returns plain allowed fields without another voter’s receipt secret', () => {
  const secret = ReceiptSecret.parse('ab'.repeat(32));
  const participant = PollParticipant.reconstitute({
    id: 'p1',
    pollId: 'poll-1',
    userId: 'user-1',
    userWeight: 2.5,
    willingToSignProtocol: true,
    receiptSecret: secret,
    snapshotAt: new Date(),
    createdAt: new Date(),
  });
  const data = serializeParticipants({
    canModify: false,
    participants: [
      {
        participant,
        user: {
          id: UserId.parse('user-1'),
          firstName: FirstName.parse('First'),
          lastName: LastName.parse('Last'),
          middleName: undefined,
        },
      },
    ],
  });
  expect(Object.getPrototypeOf(data.participants[0].participant)).toBe(
    Object.prototype
  );
  expect(data.participants[0].participant.userWeight).toBe(2.5);
  expect(JSON.stringify(data)).not.toContain(secret);
  expect(JSON.stringify(data)).not.toContain('receiptSecret');
  expect(JSON.stringify(data)).not.toContain('willingToSignProtocol');
});
