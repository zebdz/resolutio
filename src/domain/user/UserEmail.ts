/** Email presence and confirmation form one immutable state. A confirmed state
 * requires both the address and its validated instant; raw storage cannot omit either. */
import { z } from 'zod';
import { EmailAddress } from './EmailAddress';
import { Instant } from '../shared/Instant';
import { UserDomainCodes } from './UserDomainCodes';

const emailAddress = z.custom<EmailAddress>(
  (value) => value instanceof EmailAddress
);

export const UserEmail = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('absent') }).readonly(),
  z
    .object({ kind: z.literal('unconfirmed'), address: emailAddress })
    .readonly(),
  z
    .object({
      kind: z.literal('confirmed'),
      address: emailAddress,
      confirmedAt: Instant.schema,
    })
    .readonly(),
]);
export type UserEmail = z.infer<typeof UserEmail>;

export function restoreUserEmail(
  address: EmailAddress | undefined,
  confirmedAt: Instant | undefined
): UserEmail {
  if (address === undefined) {
    if (confirmedAt !== undefined) {
      throw new Error(UserDomainCodes.EMAIL_NOT_SET);
    }

    return UserEmail.parse({ kind: 'absent' });
  }

  return confirmedAt === undefined
    ? UserEmail.parse({ kind: 'unconfirmed', address })
    : UserEmail.parse({ kind: 'confirmed', address, confirmedAt });
}
