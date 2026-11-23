/** Real PostgreSQL acceptance tests for ballot atomicity and the finish cutoff.
 * Run explicitly with POLL_TEST_DATABASE_URL; the suite owns a disposable schema. */
import { PollInstant } from '@/domain/poll/PollValues';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pollDatabase } from './pollDatabase';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import { PollId, UserId, ParticipantId } from '@/domain/poll/PollValues';
import { Vote } from '@/domain/poll/Vote';
import { ReceiptSecret } from '@/domain/poll/ReceiptSecret';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { ParticipantWeightHistory } from '@/domain/poll/ParticipantWeightHistory';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { backfillReceiptSecrets } from '../ReceiptSecretBackfill';
import { voteReceiptView } from '@/application/poll/VoteReceiptView';
import { PrismaClient } from '@/generated/prisma/client';
import { ParticipantWeightHistoryId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';

describe('atomic voting database', () => {
  let db: Awaited<ReturnType<typeof pollDatabase>>;
  beforeAll(async () => {
    db = await pollDatabase();
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });

  it('never mistakes a concurrently committed original receipt for a legacy ballot', async () => {
    const f = await fixture();
    let readDone!: () => void;
    let continueRead!: () => void;
    const didRead = new Promise<void>((resolve) => {
      readDone = resolve;
    });
    const resumeRead = new Promise<void>((resolve) => {
      continueRead = resolve;
    });
    const intercepted = db.prisma.$extends({
      query: {
        pollParticipant: {
          async findUnique({ args, query }) {
            const row = await query(args);
            readDone();
            await resumeRead;

            return row;
          },
        },
      },
    });
    const reading = new PrismaParticipantRepository(
      intercepted as unknown as PrismaClient
    ).getCastBallot(f.poll.id, f.user.id);
    await didRead;

    try {
      expect(
        (
          await new PrismaParticipantRepository(db.prisma).castVotes(
            f.participant.id,
            f.votes,
            true,
            ReceiptSecret.parse('ab'.repeat(32))
          )
        ).success
      ).toBe(true);
    } finally {
      continueRead();
    }

    const observed = await reading;
    expect(observed.success).toBe(true);

    if (!observed.success) {
      throw new Error(observed.error);
    }

    expect(observed.value?.kind).not.toBe('legacy');
  });

  async function fixture() {
    const stamp = crypto.randomUUID();
    const user = await db.prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Voter',
        phoneNumber: stamp,
        password: 'test',
        nickname: stamp,
        confirmedAt: new Date(),
      },
    });
    const organization = await db.prisma.organization.create({
      data: {
        name: stamp,
        description: 'Test',
        createdById: user.id,
      },
    });
    const poll = await db.prisma.poll.create({
      data: {
        title: 'Original title',
        description: 'Test',
        organizationId: organization.id,
        createdBy: user.id,
        startDate: new Date('2026-01-01Z'),
        endDate: new Date('2026-12-31Z'),
        state: 'ACTIVE',
        questions: {
          create: [1, 2].map((n) => ({
            text: `Question ${n}`,
            answers: { create: { text: `Answer ${n}` } },
          })),
        },
      },
      include: { questions: { include: { answers: true } } },
    });
    const participant = await db.prisma.pollParticipant.create({
      data: { pollId: poll.id, userId: user.id, userWeight: '12.345678' },
    });
    const votes = poll.questions.map((q) =>
      Vote.reconstitute({
        id: crypto.randomUUID(),
        questionId: q.id,
        answerId: q.answers[0].id,
        userId: user.id,
        userWeight: 12.345678,
        createdAt: new Date('2026-10-26T10:00:00.123Z'),
      })
    );

    return {
      user: { ...user, id: UserId.parse(user.id) },
      poll: { ...poll, id: PollId.parse(poll.id) },
      participant: { ...participant, id: ParticipantId.parse(participant.id) },
      votes,
    };
  }

  it('commits a complete ballot, secret, willingness and replay snapshot with exact timestamps', async () => {
    const f = await fixture();
    const repository = new PrismaParticipantRepository(db.prisma);
    const secret = ReceiptSecret.parse('ab'.repeat(32));
    const result = await repository.castVotes(
      f.participant.id,
      f.votes,
      true,
      secret
    );
    expect(result.success).toBe(true);

    if (!result.success) {
      throw new Error(result.error);
    }

    expect(result.value.kind).toBe('original');
    const saved = await db.prisma.pollParticipant.findUniqueOrThrow({
      where: { id: f.participant.id },
    });
    expect(saved.receiptSecret).toBe(secret);
    expect(saved.willingToSignProtocol).toBe(true);
    const votes = await db.prisma.vote.findMany({
      where: { userId: f.user.id },
    });
    expect(votes).toHaveLength(2);
    expect(saved.userWeight.toFixed(6)).toBe('12.345678');
    expect(votes.map((vote) => vote.userWeight.toFixed(6))).toEqual([
      '12.345678',
      '12.345678',
    ]);

    if (result.value.kind !== 'original') {
      return expect.unreachable();
    }

    expect(result.value.snapshot.votes.map((vote) => vote.weight)).toEqual([
      '12.345678',
      '12.345678',
    ]);
    const receipt = voteReceiptView(result.value);
    expect(
      receipt.success &&
        receipt.value.kind === 'original' &&
        receipt.value.receipt.leaves.map((leaf) => leaf.preimage.weight)
    ).toEqual(['12.345678', '12.345678']);
    expect(
      votes.every(
        (v) => v.createdAt.toISOString() === '2026-10-26T10:00:00.123Z'
      )
    ).toBe(true);
    expect(await repository.getCastBallot(f.poll.id, f.user.id)).toEqual(
      result
    );
  });

  it('rejects an incomplete ballot inside the transaction without saving any part', async () => {
    const f = await fixture();
    const repository = new PrismaParticipantRepository(db.prisma);
    expect(
      (
        await repository.castVotes(
          f.participant.id,
          f.votes.slice(0, 1),
          true,
          ReceiptSecret.parse('ab'.repeat(32))
        )
      ).success
    ).toBe(false);
    expect(await db.prisma.vote.count({ where: { userId: f.user.id } })).toBe(
      0
    );
    const participant = await db.prisma.pollParticipant.findUniqueOrThrow({
      where: { id: f.participant.id },
    });
    expect(participant.receiptSecret).toBeNull();
    expect(participant.willingToSignProtocol).toBeNull();
    expect(participant.ballotSnapshot).toBeNull();
  });

  it('joins an open poll once and replays concurrent requests without replacing willingness or secret', async () => {
    const f = await fixture();
    await db.prisma.poll.update({
      where: { id: f.poll.id },
      data: { pollType: 'OPEN' },
    });
    const user = await db.prisma.user.create({
      data: {
        firstName: 'New',
        lastName: 'Voter',
        phoneNumber: crypto.randomUUID(),
        nickname: crypto.randomUUID(),
        password: 'test',
        confirmedAt: new Date(),
      },
    });
    const userId = UserId.parse(user.id);
    const participantId = ParticipantId.parse(crypto.randomUUID());
    const now = Instant.fromDate(new Date());
    const participant = PollParticipant.create(
      f.poll.id,
      userId,
      { id: participantId, now },
      VotingWeight.parse(1)
    );
    const history = ParticipantWeightHistory.create(
      participantId,
      f.poll.id,
      userId,
      VotingWeight.parse(0),
      VotingWeight.parse(1),
      userId,
      { id: ParticipantWeightHistoryId.parse(crypto.randomUUID()), now },
      'open-poll-join'
    );

    if (!participant.success || !history.success) {
      throw new Error('Invalid fixture');
    }

    const votes = f.votes.map((v) =>
      Vote.reconstitute({
        id: crypto.randomUUID(),
        questionId: v.questionId,
        answerId: v.answerId,
        userId: user.id,
        userWeight: 1,
        createdAt: v.createdAt,
      })
    );
    const repository = new PrismaParticipantRepository(db.prisma);
    const results = await Promise.all([
      repository.joinAndVote(
        participant.value,
        history.value,
        votes,
        true,
        ReceiptSecret.parse('ab'.repeat(32))
      ),
      repository.joinAndVote(
        participant.value,
        history.value,
        votes,
        false,
        ReceiptSecret.parse('cd'.repeat(32))
      ),
    ]);
    expect(results[0].success).toBe(true);
    expect(results[1]).toEqual(results[0]);
    expect(await db.prisma.vote.count({ where: { userId: user.id } })).toBe(2);
    expect(
      await db.prisma.participantWeightHistory.count({
        where: { userId: user.id },
      })
    ).toBe(1);
  });

  it('persists finish time and rejects a stale full-row save that would reopen the poll', async () => {
    const f = await fixture();
    const repository = new PrismaPollRepository(db.prisma);
    const first = await repository.getPollById(f.poll.id);
    const stale = await repository.getPollById(f.poll.id);

    if (!first.success || !first.value || !stale.success || !stale.value) {
      throw new Error('Missing poll');
    }

    const time = new Date('2026-10-26T11:00:00.123Z');
    expect(
      first.value.finish(PollInstant.parse(time.toISOString())).success
    ).toBe(true);
    expect((await repository.updatePoll(first.value)).success).toBe(true);
    expect(stale.value.deactivate().success).toBe(true);
    expect((await repository.updatePoll(stale.value)).success).toBe(false);
    const saved = await db.prisma.poll.findUniqueOrThrow({
      where: { id: f.poll.id },
    });
    expect(saved.state).toBe('FINISHED');
    expect(saved.finishedAt).toEqual(time);
  });

  it('rejects direct late vote inserts and direct reopening of finished polls', async () => {
    const f = await fixture();
    await db.prisma.poll.update({
      where: { id: f.poll.id },
      data: { state: 'FINISHED', finishedAt: new Date() },
    });
    await expect(
      db.prisma.vote.create({
        data: {
          questionId: f.votes[0].questionId,
          answerId: f.votes[0].answerId,
          userId: f.user.id,
        },
      })
    ).rejects.toThrow();
    await expect(
      db.prisma.poll.update({
        where: { id: f.poll.id },
        data: { state: 'ACTIVE', finishedAt: null },
      })
    ).rejects.toThrow();
  });

  it('protects votes and issued receipt data, with a transaction-local operator bypass', async () => {
    const f = await fixture();
    const repository = new PrismaParticipantRepository(db.prisma);
    expect(
      (
        await repository.castVotes(
          f.participant.id,
          f.votes,
          true,
          ReceiptSecret.parse('ab'.repeat(32))
        )
      ).success
    ).toBe(true);
    const vote = await db.prisma.vote.findFirstOrThrow({
      where: { userId: f.user.id },
    });
    await expect(
      db.prisma.vote.update({
        where: { id: vote.id },
        data: { userWeight: 99 },
      })
    ).rejects.toThrow();
    await expect(
      db.prisma.vote.delete({ where: { id: vote.id } })
    ).rejects.toThrow();
    await expect(
      db.prisma.pollParticipant.update({
        where: { id: f.participant.id },
        data: { receiptSecret: 'cd'.repeat(32) },
      })
    ).rejects.toThrow();
    await expect(
      db.prisma.pollParticipant.update({
        where: { id: f.participant.id },
        data: { willingToSignProtocol: false },
      })
    ).rejects.toThrow();
    await db.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.allow_immutable_mutation = 'on'`;
      await tx.vote.update({
        where: { id: vote.id },
        data: { userWeight: 99 },
      });
    });
    await expect(
      db.prisma.vote.update({ where: { id: vote.id }, data: { userWeight: 1 } })
    ).rejects.toThrow();
  });

  it('rejects stale snapshot and reconfiguration writers after another lifecycle change', async () => {
    const f = await fixture();
    const polls = new PrismaPollRepository(db.prisma);
    const loaded = await polls.getPollById(f.poll.id);

    if (!loaded.success || !loaded.value) {
      throw new Error('Missing poll');
    }

    await db.prisma.poll.update({
      where: { id: f.poll.id },
      data: { state: 'READY' },
    });
    const participants = new PrismaParticipantRepository(db.prisma);
    expect(
      (await participants.executeActivation(loaded.value, [], [])).success
    ).toBe(false);
    expect(
      (
        await participants.applyWeightConfigChange(
          f.poll.id,
          'EQUAL',
          'RAW_SUM',
          [],
          [],
          [],
          [],
          f.user.id,
          'test',
          loaded.value.revision
        )
      ).success
    ).toBe(false);
    expect(
      (await db.prisma.poll.findUniqueOrThrow({ where: { id: f.poll.id } }))
        .state
    ).toBe('READY');
  });

  it('does not infer participant removal from a generic poll save', async () => {
    const f = await fixture();
    await db.prisma.poll.update({
      where: { id: f.poll.id },
      data: { state: 'READY' },
    });
    const polls = new PrismaPollRepository(db.prisma);
    const result = await polls.getPollById(f.poll.id);

    if (!result.success || !result.value) {
      throw new Error('Missing poll');
    }

    expect(result.value.discardSnapshot(false).success).toBe(true);
    expect((await polls.updatePoll(result.value)).success).toBe(true);
    expect(
      await db.prisma.pollParticipant.count({ where: { pollId: f.poll.id } })
    ).toBe(1);
  });

  it.each(['vote-first', 'finish-first'])(
    'enforces the cutoff for %s using observed database lock barriers',
    async (order) => {
      const f = await fixture();
      const polls = new PrismaPollRepository(db.prisma);
      const participants = new PrismaParticipantRepository(db.prisma);
      const loaded = await polls.getPollById(f.poll.id);

      if (!loaded.success || !loaded.value) {
        throw new Error('Missing poll');
      }

      loaded.value.finish(
        PollInstant.parse(new Date('2026-10-26T11:00:00.000Z').toISOString())
      );
      const gate = await db.pool.connect();
      await gate.query('BEGIN');
      await gate.query('SELECT id FROM polls WHERE id = $1 FOR UPDATE', [
        f.poll.id,
      ]);
      const cast = () =>
        participants.castVotes(
          f.participant.id,
          f.votes,
          true,
          ReceiptSecret.parse('ab'.repeat(32))
        );
      const finish = () => polls.updatePoll(loaded.value!);
      let first, second;

      try {
        first = order === 'vote-first' ? cast() : finish();
        await db.waitForBlockedWriters(1);
        second = order === 'vote-first' ? finish() : cast();
        await db.waitForBlockedWriters(2);
      } finally {
        await gate.query('ROLLBACK');
        gate.release();
      }

      const outcomes = await Promise.all([first, second]);
      const voteResult = outcomes[order === 'vote-first' ? 0 : 1];
      expect(outcomes[order === 'vote-first' ? 1 : 0]?.success).toBe(true);
      expect(voteResult?.success).toBe(order === 'vote-first');
      expect(await db.prisma.vote.count({ where: { userId: f.user.id } })).toBe(
        order === 'vote-first' ? 2 : 0
      );
      expect(
        (await db.prisma.poll.findUniqueOrThrow({ where: { id: f.poll.id } }))
          .state
      ).toBe('FINISHED');
    }
  );

  it('backfills only active or paused voters, preserves secrets on rerun and never invents an original receipt', async () => {
    const active = await fixture();
    const ready = await fixture();
    const finished = await fixture();
    const noVotes = await fixture();

    for (const f of [active, ready, finished]) {
      await db.prisma.vote.createMany({
        data: f.votes.map((v) => ({
          questionId: v.questionId,
          answerId: v.answerId,
          userId: v.userId,
          userWeight: v.userWeight,
          createdAt: v.createdAt,
        })),
      });
    }

    await db.prisma.poll.update({
      where: { id: ready.poll.id },
      data: { state: 'READY' },
    });
    // Legacy FINISHED poll, intentionally no timestamp or original receipt.
    await db.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL app.allow_immutable_mutation = 'on'`;
      await tx.poll.update({
        where: { id: finished.poll.id },
        data: { state: 'FINISHED' },
      });
    });
    const generate = () => ReceiptSecret.parse('ef'.repeat(32));
    expect(await backfillReceiptSecrets(db.prisma, generate)).toBe(2);
    expect(
      await backfillReceiptSecrets(db.prisma, () =>
        ReceiptSecret.parse('12'.repeat(32))
      )
    ).toBe(0);

    for (const f of [active, ready]) {
      const participant = await db.prisma.pollParticipant.findUniqueOrThrow({
        where: { id: f.participant.id },
      });
      expect(participant.receiptSecret).toBe(generate());
      expect(participant.ballotSnapshot).toBeNull();
      expect(
        await new PrismaParticipantRepository(db.prisma).getCastBallot(
          f.poll.id,
          f.user.id
        )
      ).toEqual({ success: true, value: { kind: 'legacy' } });
    }

    for (const f of [finished, noVotes]) {
      expect(
        (
          await db.prisma.pollParticipant.findUniqueOrThrow({
            where: { id: f.participant.id },
          })
        ).receiptSecret
      ).toBeNull();
    }

    expect(
      (
        await db.prisma.poll.findUniqueOrThrow({
          where: { id: finished.poll.id },
        })
      ).finishedAt
    ).toBeNull();
  });

  it('rolls back saved votes when persisting the receipt fails', async () => {
    const f = await fixture();
    await db.pool.query(
      `ALTER TABLE poll_participants ADD CONSTRAINT test_receipt_failure CHECK (id <> '${f.participant.id}' OR ballot_snapshot IS NULL)`
    );

    try {
      const result = await new PrismaParticipantRepository(db.prisma).castVotes(
        f.participant.id,
        f.votes,
        true,
        ReceiptSecret.parse('ab'.repeat(32))
      );
      expect(result.success).toBe(false);
      expect(await db.prisma.vote.count({ where: { userId: f.user.id } })).toBe(
        0
      );
      const saved = await db.prisma.pollParticipant.findUniqueOrThrow({
        where: { id: f.participant.id },
      });
      expect(saved.receiptSecret).toBeNull();
      expect(saved.willingToSignProtocol).toBeNull();
    } finally {
      await db.pool.query(
        'ALTER TABLE poll_participants DROP CONSTRAINT test_receipt_failure'
      );
    }
  });

  it('replays identical receipt bytes after labels change and the poll finishes', async () => {
    const f = await fixture();
    const participants = new PrismaParticipantRepository(db.prisma);
    const cast = await participants.castVotes(
      f.participant.id,
      f.votes,
      true,
      ReceiptSecret.parse('ab'.repeat(32))
    );

    if (!cast.success) {
      throw new Error(cast.error);
    }

    const original = voteReceiptView(cast.value);
    expect(original.success).toBe(true);
    await db.prisma.poll.update({
      where: { id: f.poll.id },
      data: {
        title: 'Changed title',
        state: 'FINISHED',
        finishedAt: new Date(),
      },
    });
    await db.prisma.question.update({
      where: { id: f.votes[0].questionId },
      data: { text: 'Changed question' },
    });
    await db.prisma.answer.update({
      where: { id: f.votes[0].answerId },
      data: { text: 'Changed answer' },
    });
    const retry = await participants.castVotes(
      f.participant.id,
      [],
      false,
      ReceiptSecret.parse('cd'.repeat(32))
    );
    expect(retry).toEqual(cast);

    if (!retry.success) {
      throw new Error(retry.error);
    }

    expect(voteReceiptView(retry.value)).toEqual(original);
  });

  it('rejects a participant weight change once voting is active', async () => {
    const f = await fixture();
    const participants = new PrismaParticipantRepository(db.prisma);
    const loaded = await participants.getParticipantById(f.participant.id);

    if (!loaded.success || !loaded.value) {
      throw new Error('Missing participant');
    }

    const change = loaded.value.updateWeight(VotingWeight.parse(3));
    expect(change.success).toBe(true);
    const history = ParticipantWeightHistory.create(
      f.participant.id,
      f.poll.id,
      f.user.id,
      VotingWeight.parse(12.345678),
      VotingWeight.parse(3),
      f.user.id,
      {
        id: ParticipantWeightHistoryId.parse(crypto.randomUUID()),
        now: Instant.fromDate(new Date()),
      }
    );

    if (!history.success) {
      throw new Error(history.error);
    }

    expect(
      (await participants.updateParticipantWeight(loaded.value, history.value))
        .success
    ).toBe(false);
    expect(
      (
        await db.prisma.pollParticipant.findUniqueOrThrow({
          where: { id: f.participant.id },
        })
      ).userWeight.toFixed(6)
    ).toBe('12.345678');
  });
});
