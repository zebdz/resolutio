/** Decode the shared OTP lifetime at the environment boundary.
 * Missing/empty configuration keeps the ten-minute default; malformed values fail startup. */
import { Minutes } from '@/domain/auth/AuthValues';

export function otpExpiryMinutesFromEnv(): Minutes {
  return Minutes.parse(Number(process.env.OTP_EXPIRY_MINUTES || '10'));
}
