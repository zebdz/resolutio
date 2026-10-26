/** Parse raw snapshots into validated finished-poll inputs with required voter secrets.
 * Cross-field checks establish agreement between votes, participants and poll metadata. */
import { z } from 'zod';
import {
  dateSchema,
  PollSection,
  pollSchema,
  RegisterEntry,
  registerEntrySchema,
} from './RecordFormat';
import { requireSeal, SealDomainCodes } from './SealDomainCodes';
import { SealInput } from './SealInput';
import { voteSelectionSchema, VoteSelection } from './VoteLeaf';
import { QuestionId, ReceiptSecret, UserId, UtcTimestamp } from './SealValues';

export const voteInputSchema = voteSelectionSchema;
const participantSchema = registerEntrySchema.omit({ voted: true }).extend({
  receiptSecret: ReceiptSecret.schema.nullable(),
  willingToSignProtocol: z.boolean().nullable(),
  phoneNumber: z.string().nullable(),
});
const inputSchema = z.strictObject({
  state: z.string(),
  poll: pollSchema.extend({ finishedAt: dateSchema.nullable() }),
  participants: z.array(participantSchema),
  votes: z.array(voteInputSchema),
});

export function unique(values: readonly string[]): void {
  requireSeal(new Set(values).size === values.length);
}

export function validateSnapshot(
  poll: PollSection,
  participants: Omit<RegisterEntry, 'voted'>[],
  votes: readonly VoteSelection[],
  sealedAt: UtcTimestamp
): void {
  requireSeal(
    poll.createdAt <= poll.finishedAt &&
      poll.finishedAt <= poll.metadataCapturedAt &&
      poll.metadataCapturedAt <= sealedAt
  );
  requireSeal(poll.startDate <= poll.endDate);
  requireSeal((poll.boardId === null) === (poll.boardName === null));
  requireSeal(
    poll.pollType !== 'OPEN' ||
      (poll.boardId === null && poll.distributionType === 'EQUAL')
  );
  unique(poll.questions.map((q) => q.id));
  unique(poll.questions.flatMap((q) => q.answers.map((a) => a.id)));
  unique(poll.propertyIds);
  unique(poll.attachments.map((a) => a.id));
  unique(participants.map((p) => p.userId));
  unique(votes.map((v) => `${v.userId}:${v.questionId}:${v.answerId}`));
  const active = poll.questions.filter((q) => q.archivedAt === null);
  requireSeal(
    active.length > 0 &&
      active.every((q) => q.answers.some((a) => a.archivedAt === null))
  );
  const questions = new Map(poll.questions.map((q) => [q.id, q]));
  const byUser = new Map(participants.map((p) => [p.userId, p]));
  const ballots = new Map<UserId, Map<QuestionId, number>>();

  for (const p of participants) {
    requireSeal(p.snapshotAt <= poll.finishedAt);
    unique(p.holdings.map((h) => `${h.propertyId}:${h.assetId}`));
  }

  for (const vote of votes) {
    const participant = byUser.get(vote.userId);
    const question = questions.get(vote.questionId);
    requireSeal(participant && question && question.archivedAt === null);
    requireSeal(
      question.answers.some(
        (a) => a.id === vote.answerId && a.archivedAt === null
      )
    );
    requireSeal(
      vote.pollId === poll.id && vote.weight.equals(participant.weight)
    );
    requireSeal(
      vote.castAt >= poll.createdAt &&
        vote.castAt >= participant.snapshotAt &&
        vote.castAt <= poll.finishedAt
    );
    const ballot = ballots.get(vote.userId) ?? new Map<QuestionId, number>();
    ballot.set(vote.questionId, (ballot.get(vote.questionId) ?? 0) + 1);
    ballots.set(vote.userId, ballot);
  }

  for (const ballot of ballots.values()) {
    for (const question of active) {
      const count = ballot.get(question.id) ?? 0;
      requireSeal(
        count > 0 &&
          (question.questionType === 'multiple-choice' || count === 1)
      );
    }
  }

  requireSeal(
    poll.pollType !== 'OPEN' || participants.every((p) => ballots.has(p.userId))
  );
}

export function parseInput(input: SealInput, sealedAt: UtcTimestamp) {
  const parsed = inputSchema.safeParse(input);
  requireSeal(parsed.success);
  const source = parsed.data;
  const finishedAt = source.poll.finishedAt;
  requireSeal(
    source.state === 'FINISHED' && finishedAt !== null,
    SealDomainCodes.SEAL_POLL_NOT_FINISHED
  );
  const poll = { ...source.poll, finishedAt };
  validateSnapshot(poll, source.participants, source.votes, sealedAt);
  const byUser = new Map(source.participants.map((p) => [p.userId, p]));
  const votes = source.votes.map((vote) => {
    const participant = byUser.get(vote.userId);
    requireSeal(participant);
    const secret = participant.receiptSecret;
    requireSeal(secret !== null, SealDomainCodes.SEAL_MISSING_RECEIPT_SECRET);

    return { selection: vote, receiptSecret: secret };
  });

  return {
    state: 'FINISHED' as const,
    poll,
    participants: source.participants,
    votes,
  };
}
