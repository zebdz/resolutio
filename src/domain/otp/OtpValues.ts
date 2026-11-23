/** OTP counts and stored hashes are validated independently from transport data. */
import { z } from 'zod';
import { PHONE_NUMBER_REGEX } from '../user/PhoneNumber';
import { EmailAddress } from '../user/EmailAddress';

export const OtpAttempts = z
  .number()
  .int()
  .nonnegative()
  .safe()
  .brand<'OtpAttempts'>();
export type OtpAttempts = z.infer<typeof OtpAttempts>;
export const OtpAttemptLimit = z
  .number()
  .int()
  .positive()
  .safe()
  .brand<'OtpAttemptLimit'>();
export type OtpAttemptLimit = z.infer<typeof OtpAttemptLimit>;
export const OtpCount = z
  .number()
  .int()
  .nonnegative()
  .safe()
  .brand<'OtpCount'>();
export type OtpCount = z.infer<typeof OtpCount>;
export const OtpCodeHash = z.string().min(1).brand<'OtpCodeHash'>();
export type OtpCodeHash = z.infer<typeof OtpCodeHash>;

export const OtpDigits = z
  .string()
  .regex(/^\d{6}$/)
  .brand<'OtpDigits'>();
export type OtpDigits = z.infer<typeof OtpDigits>;
export const OtpChannel = z.enum(['sms', 'email']);
export type OtpChannel = z.infer<typeof OtpChannel>;

/** Purpose prevents confirmation codes from being redeemed to reset passwords. */
export const OtpPurposes = {
  PHONE_CONFIRMATION: 'phone_confirmation',
  EMAIL_CONFIRMATION: 'email_confirmation',
  PASSWORD_RESET: 'password_reset',
} as const;
export const OtpPurpose = z.enum(OtpPurposes);
export type OtpPurpose = z.infer<typeof OtpPurpose>;

const phoneAddress = z
  .string()
  .regex(PHONE_NUMBER_REGEX)
  .brand<'OtpPhoneAddress'>();
const emailAddress = z
  .string()
  .refine((value) => {
    try {
      EmailAddress.create(value);

      return true;
    } catch {
      return false;
    }
  })
  .transform((value) => EmailAddress.create(value).getValue())
  .brand<'OtpEmailAddress'>();

/** An SMS destination cannot carry an email address, or vice versa. */
export const OtpSmsDestination = z.object({
  channel: z.literal('sms'),
  identifier: phoneAddress,
});
export type OtpSmsDestination = z.infer<typeof OtpSmsDestination>;
export const OtpEmailDestination = z.object({
  channel: z.literal('email'),
  identifier: emailAddress,
});
export type OtpEmailDestination = z.infer<typeof OtpEmailDestination>;
export const OtpDestination = z.discriminatedUnion('channel', [
  OtpSmsDestination,
  OtpEmailDestination,
]);
export type OtpDestination = z.infer<typeof OtpDestination>;

/** A validated SMS/email address; provider payloads serialize this at their boundary. */
export type OtpRecipient<C extends OtpChannel = OtpChannel> = Extract<
  OtpDestination,
  { channel: C }
>['identifier'];
