/** Translates a user-context profile into the minimal poll administration display.
 * Keeping this projection explicit prevents credentials/private fields spreading. */
import { User } from '@/domain/user/User';

export type PollUserDisplay = Readonly<
  Pick<User, 'id' | 'firstName' | 'lastName' | 'middleName'>
>;

export function pollUserDisplay(user: PollUserDisplay): PollUserDisplay {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
  };
}
