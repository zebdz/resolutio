/** Validated profile values distinguish names, plaintext credentials and stored password hashes.
 * Password hashes stay opaque: supported encodings belong to the hashing adapter. */
import { z } from 'zod';
import { UserDomainCodes, UserDomainCode } from './UserDomainCodes';

export const NAME_MIN_LENGTH = 2;
export const NAME_MAX_LENGTH = 50;
export const NAME_REGEX = /^[A-ZА-ЯЁ][a-zA-Zа-яёА-ЯЁ'\u2019\-]+$/;
export const PASSWORD_MIN_LENGTH = 8;

function nameSchema(required: UserDomainCode, invalid: UserDomainCode) {
  return z
    .string()
    .refine((value) => value.trim().length > 0, required)
    .max(NAME_MAX_LENGTH, invalid)
    .regex(NAME_REGEX, invalid);
}

export const FirstName = nameSchema(
  UserDomainCodes.FIRST_NAME_REQUIRED,
  UserDomainCodes.FIRST_NAME_INVALID
).brand<'FirstName'>();
export type FirstName = z.infer<typeof FirstName>;
export const LastName = nameSchema(
  UserDomainCodes.LAST_NAME_REQUIRED,
  UserDomainCodes.LAST_NAME_INVALID
).brand<'LastName'>();
export type LastName = z.infer<typeof LastName>;
export const MiddleName = nameSchema(
  UserDomainCodes.MIDDLE_NAME_INVALID,
  UserDomainCodes.MIDDLE_NAME_INVALID
).brand<'MiddleName'>();
export type MiddleName = z.infer<typeof MiddleName>;

export const PasswordHash = z
  .string()
  .refine((value) => value.trim().length > 0, UserDomainCodes.PASSWORD_REQUIRED)
  .brand<'PasswordHash'>();
export type PasswordHash = z.infer<typeof PasswordHash>;
/** Entered credentials are exact strings; signup/reset policy is checked separately.
 * Empty/short legacy attempts must still reach verification without normalization. */
export const PlaintextPassword = z
  .string({ error: UserDomainCodes.PASSWORD_REQUIRED })
  .brand<'PlaintextPassword'>();
export type PlaintextPassword = z.infer<typeof PlaintextPassword>;
/** Generated resets retain their existing composition guarantee; this does not
 * constrain entered login passwords or establish how much randomness was used. */
export const GeneratedPassword = PlaintextPassword.min(PASSWORD_MIN_LENGTH)
  .regex(/[a-z]/)
  .regex(/[A-Z]/)
  .regex(/[0-9]/)
  .brand<'GeneratedPassword'>();
export type GeneratedPassword = z.infer<typeof GeneratedPassword>;
export const Language = z.enum(['en', 'ru'], {
  error: UserDomainCodes.LANGUAGE_INVALID,
});
export type Language = z.infer<typeof Language>;
