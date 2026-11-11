/** All poll lifecycle and ballot writers take this parent lock first. A failed
 * transaction throws an internal code so Prisma rolls back before returning it. */
import { Prisma } from '@/generated/prisma/client';
import { Poll } from '@/domain/poll/Poll';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';

import { PollId } from '@/domain/poll/PollValues';
import { PollWriteFailure } from '@/domain/poll/PollWriteFailure';

export class PollWriteError extends Error {
  constructor(readonly code: PollWriteFailure) {
    super(code);
  }
}

export async function lockPoll(tx: Prisma.TransactionClient, pollId: PollId) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM polls WHERE id = ${pollId} FOR UPDATE
  `;

  if (rows.length !== 1) {
    throw new PollWriteError('poll.errors.pollNotFound');
  }
}

export function pollWriteError(error: unknown): PollWriteFailure {
  return error instanceof PollWriteError
    ? error.code
    : 'common.errors.unexpected';
}

export async function lockPollRevision(
  tx: Prisma.TransactionClient,
  poll: Poll
) {
  await lockPoll(tx, PollId.parse(poll.id));
  const current = await tx.poll.findUniqueOrThrow({ where: { id: poll.id } });

  if (current.revision !== poll.revision) {
    throw new PollWriteError(PollDomainCodes.POLL_STALE);
  }

  return current;
}
