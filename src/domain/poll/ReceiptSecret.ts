/** Poll-owned receipt credential. The sealing context validates its own value
 * when the application translates a committed ballot into a receipt. */
import { z } from 'zod';

export const ReceiptSecret = z
  .string()
  .regex(/^[0-9a-f]{64}$/)
  .brand<'PollReceiptSecret'>();
export type ReceiptSecret = z.infer<typeof ReceiptSecret>;
