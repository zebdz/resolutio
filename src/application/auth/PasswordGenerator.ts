/** Supplies a validated generated credential; randomness belongs to the adapter. */
import { GeneratedPassword } from '@/domain/user/UserValues';

export interface PasswordGenerator {
  generate(): GeneratedPassword;
}
