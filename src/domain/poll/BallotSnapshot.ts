/** Versioned cast-time snapshot, independent of the seal context. Exact decimals,
 * labels and timestamps are retained so replay never reads mutable live joins. */
import { z } from 'zod';
import { ReceiptSecret } from './ReceiptSecret';

import {
  PollId,
  UserId,
  QuestionId,
  AnswerId,
  PollInstant,
  BallotWeight,
} from './PollValues';
export { BallotWeight } from './PollValues';

export const BallotSnapshot = z
  .strictObject({
    version: z.literal(1),
    pollId: PollId,
    userId: UserId,
    receiptSecret: ReceiptSecret,
    pollTitle: z.string(),
    votes: z
      .array(
        z
          .strictObject({
            questionId: QuestionId,
            answerId: AnswerId,
            weight: BallotWeight,
            castAt: PollInstant,
            questionText: z.string(),
            answerText: z.string(),
          })
          .readonly()
      )
      .min(1)
      .readonly(),
  })
  .readonly();
export type BallotSnapshot = z.infer<typeof BallotSnapshot>;

export type RecordedBallot =
  | { readonly kind: 'original'; readonly snapshot: BallotSnapshot }
  | { readonly kind: 'legacy' };
