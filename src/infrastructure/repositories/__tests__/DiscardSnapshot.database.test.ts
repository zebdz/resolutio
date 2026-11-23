/** PostgreSQL acceptance tests for explicit snapshot discard: domain decisions
 * use locked inputs and the lifecycle write/removal commit or roll back together. */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { pollDatabase } from './pollDatabase';
import { DiscardSnapshotUseCase } from '@/application/poll/DiscardSnapshotUseCase';
import { PrismaPollSnapshotTransaction } from '../PrismaPollSnapshotTransaction';
import { PrismaPollRepository } from '../PrismaPollRepository';
import { PrismaOrganizationRepository } from '../PrismaOrganizationRepository';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { PrismaBoardRepository } from '../PrismaBoardRepository';
import { PrismaClient } from '@/generated/prisma/client';
import { success, failure } from '@/domain/shared/Result';
import { PollId } from '@/domain/poll/PollValues';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';

describe('snapshot discard transaction', () => {
  let db: Awaited<ReturnType<typeof pollDatabase>>;
  beforeAll(async () => {
    db = await pollDatabase();
  }, 30_000);
  afterAll(async () => {
    await db?.close();
  });

  function useCase(prisma: PrismaClient = db.prisma) {
    return new DiscardSnapshotUseCase(
      new PrismaPollRepository(prisma),
      new PrismaPollSnapshotTransaction(prisma),
      new PrismaOrganizationRepository(prisma),
      new PrismaUserRepository(prisma),
      new PrismaBoardRepository(prisma)
    );
  }

  async function fixture() {
    const stamp = crypto.randomUUID();
    const user = await db.prisma.user.create({
      data: {
        firstName: 'Test',
        lastName: 'Admin',
        phoneNumber: stamp,
        password: 'test',
        nickname: stamp,
        superAdmin: { create: {} },
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
        title: 'Snapshot',
        description: 'Test',
        organizationId: organization.id,
        createdBy: user.id,
        startDate: new Date('2026-01-01Z'),
        endDate: new Date('2026-12-31Z'),
        state: 'READY',
        questions: {
          create: { text: 'Question', answers: { create: { text: 'Answer' } } },
        },
        participants: { create: { userId: user.id } },
      },
      include: {
        questions: { include: { answers: true } },
        participants: true,
      },
    });

    return { user, poll: { ...poll, id: PollId.parse(poll.id) } };
  }

  it('explicitly discards the participant snapshot and returns the poll to SUBMITTED', async () => {
    const { user, poll } = await fixture();

    expect(
      await useCase().execute({ pollId: poll.id, userId: user.id })
    ).toEqual(success(undefined));
    const saved = await db.prisma.poll.findUniqueOrThrow({
      where: { id: poll.id },
      include: { participants: true },
    });
    expect(saved.state).toBe('SUBMITTED');
    expect(saved.revision).toBe(poll.revision + 1);
    expect(saved.participants).toEqual([]);
  });

  it('rolls back all writes when the application callback returns a failure', async () => {
    const { poll } = await fixture();
    const rejected = failure(PollDomainCodes.POLL_STALE);
    const result = await new PrismaPollSnapshotTransaction(
      db.prisma
    ).withLockedPoll(poll.id, async (snapshot) => {
      expect(snapshot.poll.discardSnapshot(await snapshot.hasVotes())).toEqual(
        success(undefined)
      );
      await snapshot.savePoll();
      await snapshot.removeParticipantSnapshot();

      return rejected;
    });

    expect(result).toEqual(rejected);
    const saved = await db.prisma.poll.findUniqueOrThrow({
      where: { id: poll.id },
      include: { participants: true },
    });
    expect(saved.state).toBe('READY');
    expect(saved.revision).toBe(poll.revision);
    expect(saved.participants).toEqual(poll.participants);
  });

  it('rolls back the poll save when removing participants fails', async () => {
    const { user, poll } = await fixture();
    // A test-only FK makes the second write fail after the lifecycle save.
    await db.pool.query(
      'CREATE TABLE discard_guard (participant_id TEXT REFERENCES poll_participants(id) ON DELETE RESTRICT)'
    );

    try {
      await db.pool.query('INSERT INTO discard_guard VALUES ($1)', [
        poll.participants[0].id,
      ]);
      expect(
        await useCase().execute({ pollId: poll.id, userId: user.id })
      ).toEqual(failure('common.errors.unexpected'));
      const saved = await db.prisma.poll.findUniqueOrThrow({
        where: { id: poll.id },
        include: { participants: true },
      });
      expect(saved.state).toBe('READY');
      expect(saved.revision).toBe(poll.revision);
      expect(saved.participants).toEqual(poll.participants);
    } finally {
      await db.pool.query('DROP TABLE discard_guard');
    }
  });

  it.each(['activation', 'vote-and-pause'] as const)(
    'rejects discard when %s commits before it gets the poll lock',
    async (change) => {
      const { user, poll } = await fixture();
      const gate = await db.pool.connect();
      await gate.query('BEGIN');
      await gate.query('SELECT id FROM polls WHERE id = $1 FOR UPDATE', [
        poll.id,
      ]);
      const discarding = useCase().execute({
        pollId: poll.id,
        userId: user.id,
      });

      try {
        // Authorization has read READY; the application is now waiting for its transaction lock.
        await db.waitForBlockedWriters(1);
        await gate.query("UPDATE polls SET state = 'ACTIVE' WHERE id = $1", [
          poll.id,
        ]);

        if (change === 'vote-and-pause') {
          const question = poll.questions[0];
          await gate.query(
            'INSERT INTO votes (id, question_id, answer_id, user_id) VALUES ($1, $2, $3, $4)',
            [crypto.randomUUID(), question.id, question.answers[0].id, user.id]
          );
          await gate.query("UPDATE polls SET state = 'READY' WHERE id = $1", [
            poll.id,
          ]);
        }

        await gate.query('COMMIT');
      } finally {
        await gate.query('ROLLBACK');
        gate.release();
      }

      expect(await discarding).toEqual(
        failure(
          change === 'activation'
            ? PollDomainCodes.POLL_MUST_BE_READY
            : PollDomainCodes.POLL_CANNOT_DISCARD_SNAPSHOT_HAS_VOTES
        )
      );
      const saved = await db.prisma.poll.findUniqueOrThrow({
        where: { id: poll.id },
        include: { participants: true },
      });
      expect(saved.state).toBe(change === 'activation' ? 'ACTIVE' : 'READY');
      expect(saved.participants).toEqual(poll.participants);
    }
  );
});
