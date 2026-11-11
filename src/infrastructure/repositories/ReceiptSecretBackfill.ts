/** Restartable rollout backfill. Locks each poll before rechecking eligibility;
 * preserves existing secrets and never manufactures cast-time receipt evidence. */
import { PrismaClient } from '@/generated/prisma/client';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import { PollId } from '@/domain/poll/PollValues';
import { lockPoll } from './PollWriteLock';

export async function backfillReceiptSecrets(
  prisma: PrismaClient,
  generate: () => ReceiptSecret
): Promise<number> {
  let assigned = 0;

  while (true) {
    const candidates = await prisma.$queryRaw<{ id: string; pollId: string }[]>`
      SELECT pp.id, pp.poll_id AS "pollId" FROM poll_participants pp
      JOIN polls p ON p.id = pp.poll_id
      WHERE pp.receipt_secret IS NULL AND p.state IN ('ACTIVE', 'READY')
        AND EXISTS (SELECT 1 FROM votes v JOIN questions q ON q.id = v.question_id
          WHERE q.poll_id = p.id AND v.user_id = pp.user_id)
      ORDER BY pp.id LIMIT 100
    `;

    if (candidates.length === 0) {
      return assigned;
    }

    for (const candidate of candidates) {
      assigned += await prisma.$transaction(async (tx) => {
        await lockPoll(tx, PollId.parse(candidate.pollId));
        const poll = await tx.poll.findUniqueOrThrow({
          where: { id: candidate.pollId },
        });

        if (poll.state !== 'ACTIVE' && poll.state !== 'READY') {
          return 0;
        }

        const participant = await tx.pollParticipant.findUnique({
          where: { id: candidate.id },
        });

        if (!participant || participant.receiptSecret !== null) {
          return 0;
        }

        if (
          !(await tx.vote.findFirst({
            where: {
              userId: participant.userId,
              question: { pollId: poll.id },
            },
          }))
        ) {
          return 0;
        }

        await tx.pollParticipant.update({
          where: { id: participant.id },
          data: { receiptSecret: ReceiptSecret.parse(generate()) },
        });

        return 1;
      });
    }
  }
}
