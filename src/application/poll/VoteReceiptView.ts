/** Translates the poll's frozen cast snapshot into seal v1 evidence. The plain
 * view is owner-only; legacy votes explicitly carry no original receipt. */
import { RecordedBallot } from '@/domain/poll/BallotSnapshot';
import { ReceiptData, VoteReceipt } from '@/domain/seal/VoteReceipt';
import { SealDomainCode } from '@/domain/seal/SealDomainCodes';
import { Result, success } from '@/domain/shared/Result';

export type VoteReceiptView =
  | { kind: 'original'; receipt: ReceiptData; canonicalReceipt: string }
  | { kind: 'legacy' };

export function voteReceiptView(
  ballot: RecordedBallot
): Result<VoteReceiptView, SealDomainCode> {
  if (ballot.kind === 'legacy') {
    return success({ kind: 'legacy' });
  }

  const snapshot = ballot.snapshot;
  const receipt = VoteReceipt.create({
    pollId: snapshot.pollId,
    userId: snapshot.userId,
    receiptSecret: snapshot.receiptSecret,
    pollTitle: snapshot.pollTitle,
    votes: snapshot.votes.map((v) => ({
      pollId: snapshot.pollId,
      userId: snapshot.userId,
      questionId: v.questionId,
      answerId: v.answerId,
      weight: v.weight,
      castAt: v.castAt,
      questionText: v.questionText,
      answerText: v.answerText,
    })),
  });

  if (!receipt.success) {
    return receipt;
  }

  return success({
    kind: 'original',
    receipt: receipt.value.data,
    canonicalReceipt: receipt.value.bytes,
  });
}
