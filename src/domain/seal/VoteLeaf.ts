/** Salted ballot commitments operate on validated votes; explicit codecs preserve
 * the v1 wire format. The caller supplies persisted time and the participant's secret. */
import { z } from 'zod';
import { canonical } from './Canonical';
import { hashBytes, hmacHex } from './Hash';
import { requireSeal } from './SealDomainCodes';
import { Weight } from './Weight';
import {
  AnswerId,
  QuestionId,
  ReceiptSecret,
  VoteSalt,
  PollId,
  UserId,
  UtcTimestamp,
} from './SealValues';

export const rowWeightSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]{0,8})\.[0-9]{6}$/)
  .transform(Weight.fromDecimalString)
  .brand<'RowWeight'>();
export type RowWeight = z.output<typeof rowWeightSchema>;
export const voteSelectionSchema = z.strictObject({
  pollId: PollId.schema,
  questionId: QuestionId.schema,
  answerId: AnswerId.schema,
  userId: UserId.schema,
  weight: rowWeightSchema,
  castAt: UtcTimestamp.schema,
});
const preimageFields = voteSelectionSchema.extend({ salt: VoteSalt.schema });
export const votePreimageSchema = preimageFields.readonly();
export type VoteSelection = z.output<typeof voteSelectionSchema>;
export type VotePreimage = z.output<typeof votePreimageSchema>;
export type VotePreimageData = z.input<typeof preimageFields>;

export function parseVotePreimage(value: unknown): VotePreimage {
  const parsed = votePreimageSchema.safeParse(value);
  requireSeal(parsed.success);

  return parsed.data;
}

export function votePreimageData(vote: VotePreimage): VotePreimageData {
  return {
    pollId: vote.pollId,
    questionId: vote.questionId,
    answerId: vote.answerId,
    userId: vote.userId,
    weight: vote.weight.toDecimalString(),
    castAt: vote.castAt,
    salt: vote.salt,
  };
}

export function deriveSalt(
  secret: ReceiptSecret,
  questionId: QuestionId,
  answerId: AnswerId
): VoteSalt {
  return VoteSalt.parse(hmacHex(secret, `${questionId}:${answerId}`));
}

export function hashLeaf(preimage: VotePreimage) {
  return hashBytes(
    new Uint8Array([0]),
    new TextEncoder().encode(canonical(votePreimageData(preimage)))
  );
}
