/** Original cast-time evidence. Pure construction uses committed values supplied
 * by the application; parsing preserves bytes instead of repairing altered input. */
import { canonical, parseCanonical, prepareNfc } from './Canonical';
import { z } from 'zod';
import { hashSchema } from './RecordFormat';
import { unique, voteInputSchema } from './SnapshotValidation';
import { requireSeal, sealResult } from './SealDomainCodes';
import {
  deriveSalt,
  hashLeaf,
  VotePreimageData,
  votePreimageSchema,
  votePreimageData,
} from './VoteLeaf';
import { PollId, UserId, ReceiptSecret, Digest } from './SealValues';
import { assertV1, compareText } from './Validation';

export interface ReceiptData {
  version: 1;
  algorithm: 'sha256';
  pollId: string;
  userId: string;
  receiptSecret: string;
  pollTitle: string;
  leaves: {
    preimage: VotePreimageData;
    hash: string;
    questionText: string;
    answerText: string;
  }[];
}
export interface ReceiptInput extends Pick<
  ReceiptData,
  'pollId' | 'userId' | 'receiptSecret' | 'pollTitle'
> {
  votes: (Omit<VotePreimageData, 'salt'> & {
    questionText: string;
    answerText: string;
  })[];
}
const labelFields = { questionText: z.string(), answerText: z.string() };
const receiptFields = {
  pollId: PollId.schema,
  userId: UserId.schema,
  receiptSecret: ReceiptSecret.schema,
  pollTitle: z.string(),
};
const receiptInputSchema = z.strictObject({
  ...receiptFields,
  votes: z.array(voteInputSchema.extend(labelFields)).min(1),
});
const receiptSchema = z.strictObject({
  version: z.literal(1),
  algorithm: z.literal('sha256'),
  ...receiptFields,
  leaves: z
    .array(
      z.strictObject({
        preimage: votePreimageSchema,
        hash: hashSchema,
        ...labelFields,
      })
    )
    .min(1),
});

function validateReceipt(value: unknown) {
  assertV1(value);
  const parsed = receiptSchema.safeParse(value);
  requireSeal(parsed.success);
  const data = parsed.data;
  unique(
    data.leaves.map(
      (leaf) => `${leaf.preimage.questionId}:${leaf.preimage.answerId}`
    )
  );
  let previous: Digest | undefined;

  for (const leaf of data.leaves) {
    const vote = leaf.preimage;
    requireSeal(vote.pollId === data.pollId && vote.userId === data.userId);
    requireSeal(vote.weight.equals(data.leaves[0].preimage.weight));
    requireSeal(
      vote.salt ===
        deriveSalt(data.receiptSecret, vote.questionId, vote.answerId)
    );
    requireSeal(
      leaf.hash === hashLeaf(vote) &&
        (previous === undefined || leaf.hash > previous)
    );
    previous = leaf.hash;
  }

  return data;
}

export class VoteReceipt {
  private constructor(readonly bytes: string) {}
  get data(): ReceiptData {
    return JSON.parse(this.bytes);
  }

  static create(input: ReceiptInput) {
    return sealResult(() => {
      const parsed = receiptInputSchema.safeParse(prepareNfc(input));
      requireSeal(parsed.success);
      const prepared = parsed.data;
      const data: ReceiptData = {
        version: 1,
        algorithm: 'sha256',
        pollId: prepared.pollId,
        userId: prepared.userId,
        receiptSecret: prepared.receiptSecret,
        pollTitle: prepared.pollTitle,
        leaves: prepared.votes
          .map(({ questionText, answerText, ...vote }) => {
            const preimage = {
              ...vote,
              salt: deriveSalt(
                prepared.receiptSecret,
                vote.questionId,
                vote.answerId
              ),
            };

            return {
              preimage: votePreimageData(preimage),
              hash: hashLeaf(preimage),
              questionText,
              answerText,
            };
          })
          .sort((a, b) => compareText(a.hash, b.hash)),
      };
      validateReceipt(data);

      return new VoteReceipt(canonical(data));
    });
  }

  static parse(bytes: string | Uint8Array) {
    return sealResult(() => {
      const data = parseCanonical(bytes);
      validateReceipt(data);

      return new VoteReceipt(canonical(data));
    });
  }
}
