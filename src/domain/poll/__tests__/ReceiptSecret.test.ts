/** Participant secrets are validated, assigned once, and safe to rehydrate.
 * No randomness belongs in the participant itself. */
import { expect, it } from 'vitest';
import { PollParticipant } from '../PollParticipant';
import { ReceiptSecret } from '../ReceiptSecret';
import { PollId, UserId, ParticipantId } from '../../shared/EntityIds';
import { testCreation } from '../../shared/__tests__/creation';

it('allows the same secret again but never a replacement', () => {
  const result = PollParticipant.create(
    PollId.parse('poll-1'),
    UserId.parse('user-1'),
    testCreation(ParticipantId, 'participant-1')
  );

  if (!result.success) {
    throw new Error(result.error);
  }

  const participant = result.value;
  const secret = ReceiptSecret.parse('ab'.repeat(32));
  expect(participant.receiptSecret).toBeNull();
  expect(participant.assignReceiptSecret(secret).success).toBe(true);
  expect(participant.assignReceiptSecret(secret).success).toBe(true);
  expect(
    participant.assignReceiptSecret(ReceiptSecret.parse('cd'.repeat(32)))
      .success
  ).toBe(false);
  expect(participant.receiptSecret).toBe(secret);
  expect(() => ReceiptSecret.parse('short')).toThrow();
});
