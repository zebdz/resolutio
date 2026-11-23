/** Entropy port for casting ballots. Production supplies cryptographic random
 * bytes; tests supply stable secrets without randomness in the domain. */
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
export interface ReceiptSecretGenerator {
  generate(): ReceiptSecret;
}
