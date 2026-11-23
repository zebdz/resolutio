/** Transaction-local ballot persistence. Reads exact saved rows and freezes
 * labels before commit; the application builds the seal-context receipt afterward. */
import { Prisma } from '@/generated/prisma/client';
import { BallotSnapshot, RecordedBallot } from '@/domain/poll/BallotSnapshot';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import { Vote } from '@/domain/poll/Vote';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';
import { PollId, UserId, ParticipantId } from '@/domain/poll/PollValues';
import { PollWriteError } from './PollWriteLock';
import { validateBallot, BallotFacts } from '@/domain/poll/BallotPolicy';

export async function readCastBallot(
  tx: Prisma.TransactionClient,
  pollId: PollId,
  userId: UserId
): Promise<RecordedBallot | null> {
  const participant = await tx.pollParticipant.findUnique({
    where: { pollId_userId: { pollId, userId } },
  });

  if (participant?.ballotSnapshot != null) {
    const snapshot = BallotSnapshot.parse(participant.ballotSnapshot);

    if (
      snapshot.pollId !== pollId ||
      snapshot.userId !== userId ||
      snapshot.receiptSecret !== participant.receiptSecret
    ) {
      throw new Error('Invalid stored ballot identity');
    }

    return { kind: 'original', snapshot };
  }

  const vote = await tx.vote.findFirst({
    where: { userId, question: { pollId } },
  });

  return vote ? { kind: 'legacy' } : null;
}

export async function saveCastBallot(
  tx: Prisma.TransactionClient,
  participantId: ParticipantId,
  votes: Vote[],
  willingToSignProtocol: boolean,
  secret: ReceiptSecret
): Promise<RecordedBallot> {
  const participant = await tx.pollParticipant.findUniqueOrThrow({
    where: { id: participantId },
  });
  const poll = await tx.poll.findUniqueOrThrow({
    where: { id: participant.pollId },
    include: {
      questions: {
        where: { archivedAt: null },
        include: { answers: { where: { archivedAt: null } } },
      },
      organization: true,
      board: true,
    },
  });
  const user = await tx.user.findUniqueOrThrow({
    where: { id: participant.userId },
  });
  const facts = BallotFacts.safeParse({
    poll: {
      state: poll.state,
      pollType: poll.pollType,
      archived:
        poll.archivedAt !== null ||
        poll.organization.archivedAt !== null ||
        poll.board?.archivedAt != null,
      questions: poll.questions.map((q) => ({
        id: q.id,
        questionType: q.questionType,
        answerIds: q.answers.map((a) => a.id),
      })),
    },
    voter: {
      userId: user.id,
      weight: participant.userWeight.toFixed(6),
      participant: true,
      confirmed: user.confirmedAt !== null,
    },
    votes: votes.map((v) => ({
      questionId: v.questionId,
      answerId: v.answerId,
      userId: v.userId,
      weight: new Prisma.Decimal(v.userWeight).toFixed(6),
    })),
  });

  if (!facts.success) {
    throw new PollWriteError(PollDomainCodes.INVALID_BALLOT);
  }

  const validation = validateBallot(
    facts.data.poll,
    facts.data.voter,
    facts.data.votes
  );

  if (!validation.success) {
    throw new PollWriteError(validation.error);
  }

  await tx.vote.createMany({
    data: votes.map((v) => ({
      id: v.id,
      questionId: v.questionId,
      answerId: v.answerId,
      userId: v.userId,
      userWeight: new Prisma.Decimal(v.userWeight),
      createdAt: v.createdAt,
    })),
  });

  if (
    participant.receiptSecret !== null &&
    participant.receiptSecret !== secret
  ) {
    throw new PollWriteError(PollDomainCodes.RECEIPT_SECRET_IMMUTABLE);
  }

  const savedVotes = await tx.vote.findMany({
    where: { userId: participant.userId, question: { pollId: poll.id } },
    include: { question: true, answer: true },
  });
  const snapshot = BallotSnapshot.parse({
    version: 1,
    pollId: poll.id,
    userId: participant.userId,
    receiptSecret: secret,
    pollTitle: poll.title,
    votes: savedVotes.map((v) => ({
      questionId: v.questionId,
      answerId: v.answerId,
      weight: v.userWeight.toFixed(6),
      castAt: v.createdAt.toISOString(),
      questionText: v.question.text,
      answerText: v.answer.text,
    })),
  });
  await tx.pollParticipant.update({
    where: { id: participantId },
    data: {
      willingToSignProtocol,
      receiptSecret: secret,
      ballotSnapshot: snapshot,
    },
  });

  return { kind: 'original', snapshot };
}
