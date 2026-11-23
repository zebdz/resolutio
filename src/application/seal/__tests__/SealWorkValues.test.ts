/** Work-claim boundary contracts prevent raw identities and invalid lease durations
 * entering the sealing workflow. PostgreSQL exercises ownership separately. */
import { expect, it } from 'vitest';
import { SealLeaseSeconds, SealWorkOwner } from '../SealWorkRepository';
import { PollId } from '@/domain/seal/SealValues';

it('validates owner tokens using their own identity contract', () => {
  expect(SealWorkOwner.parse('worker_01-a')).toBe('worker_01-a');
  expect(SealWorkOwner.parse('a'.repeat(256))).toHaveLength(256);

  for (const value of ['', ' ', 'a:b', 'a'.repeat(257), 1, null]) {
    expect(SealWorkOwner.safeParse(value).success).toBe(false);
  }
});
it('requires bounded positive whole lease seconds', () => {
  expect(SealLeaseSeconds.parse(60)).toBe(60);

  for (const value of [0, -1, 0.5, Infinity, NaN, 2147483648, '60', null]) {
    expect(SealLeaseSeconds.safeParse(value).success).toBe(false);
  }
});

// Typecheck rejects raw tokens, swapped identities and unvalidated durations.
function compilerContracts(owner: SealWorkOwner, pollId: PollId) {
  // @ts-expect-error Poll identities are not work-owner identities.
  const swapped: SealWorkOwner = pollId;
  // @ts-expect-error Raw strings must pass the owner constructor.
  const raw: SealWorkOwner = 'worker';
  // @ts-expect-error Work-owner identities cannot identify a poll.
  const poll: PollId = owner;
  // @ts-expect-error Durations require validation.
  const seconds: SealLeaseSeconds = 60;
}
