/** Production entropy adapter: 256 random bits per attempted ballot. A retry
 * reuses committed evidence; unused race-losing secrets are never persisted. */
import { randomBytes } from 'node:crypto';
import { ReceiptSecretGenerator } from '@/application/poll/ReceiptSecretGenerator';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
export class CryptoReceiptSecretGenerator implements ReceiptSecretGenerator {
  generate(): ReceiptSecret {
    return ReceiptSecret.parse(randomBytes(32).toString('hex'));
  }
}
