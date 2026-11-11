/** Hashes validated OTP digits with the configured server secret.
 * Stored hashes remain distinct from plaintext codes at the application boundary. */
import { OtpCodeHash, OtpDigits } from '@/domain/otp/OtpValues';
import { createHmac } from 'crypto';
import type { OtpCodeHasher } from '@/application/auth/OtpCodeHasher';

export class OtpCodeHasherImpl implements OtpCodeHasher {
  constructor(private readonly secret: string) {}

  hash(code: OtpDigits): OtpCodeHash {
    return OtpCodeHash.parse(
      createHmac('sha256', this.secret).update(code).digest('hex')
    );
  }

  verify(code: OtpDigits, hash: OtpCodeHash): boolean {
    return this.hash(code) === hash;
  }
}
