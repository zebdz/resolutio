/** Hashing port keeps entered digits distinct from persisted opaque hashes. */
import { OtpCodeHash, OtpDigits } from '@/domain/otp/OtpValues';

export interface OtpCodeHasher {
  hash(code: OtpDigits): OtpCodeHash;
  verify(code: OtpDigits, hash: OtpCodeHash): boolean;
}

/** Raw form input may be malformed; it still counts as an unsuccessful attempt. */
export function verifyEnteredOtpCode(
  hasher: OtpCodeHasher,
  raw: string,
  hash: OtpCodeHash
): boolean {
  const code = OtpDigits.safeParse(raw);

  return code.success && hasher.verify(code.data, hash);
}
