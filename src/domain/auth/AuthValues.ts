/** Authentication uses validated addresses and explicit duration units.
 * Time arithmetic is pure; clocks and transport parsing belong outside the domain. */
import { z } from 'zod';
import { Instant } from '../shared/Instant';

export const ClientIp = z.union([z.ipv4(), z.ipv6()]).brand<'AuthClientIp'>();
export type ClientIp = z.infer<typeof ClientIp>;
/** Opaque challenge text is never normalized; the verification provider owns validity. */
export const CaptchaToken = z.string().min(1).brand<'CaptchaToken'>();
export type CaptchaToken = z.infer<typeof CaptchaToken>;
export const CaptchaChallenge = z
  .object({
    token: CaptchaToken,
    clientIp: ClientIp,
  })
  .readonly();
export type CaptchaChallenge = z.infer<typeof CaptchaChallenge>;
export const Seconds = z
  .number()
  .int()
  .nonnegative()
  .safe()
  .brand<'AuthSeconds'>();
export type Seconds = z.infer<typeof Seconds>;
export const Minutes = z
  .number()
  .int()
  .positive()
  .safe()
  .brand<'AuthMinutes'>();
export type Minutes = z.infer<typeof Minutes>;

export function secondsFromMinutes(minutes: Minutes): Seconds {
  return Seconds.parse(minutes * 60);
}

export function afterSeconds(now: Instant, seconds: Seconds): Instant {
  return Instant.fromDate(
    new Date(Instant.toDate(now).getTime() + seconds * 1000)
  );
}

export function beforeSeconds(now: Instant, seconds: Seconds): Instant {
  return Instant.fromDate(
    new Date(Instant.toDate(now).getTime() - seconds * 1000)
  );
}
