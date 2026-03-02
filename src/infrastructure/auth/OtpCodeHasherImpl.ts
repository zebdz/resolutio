import { createHmac } from 'crypto';
import type { OtpCodeHasher } from '@/application/auth/OtpCodeHasher';

export class OtpCodeHasherImpl implements OtpCodeHasher {
  constructor(private readonly secret: string) {}

  hash(code: string): string {
    return createHmac('sha256', this.secret).update(code).digest('hex');
  }

  verify(code: string, hash: string): boolean {
    return this.hash(code) === hash;
  }
}
