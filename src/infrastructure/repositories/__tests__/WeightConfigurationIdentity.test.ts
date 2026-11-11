/** Reconfiguration persists assigned participant/audit identities and advances
 * the poll revision, so earlier loaded writers cannot overwrite the new config. */
import { expect, it, vi } from 'vitest';
import { Prisma, PrismaClient } from '@/generated/prisma/client';
import { PrismaParticipantRepository } from '../PrismaParticipantRepository';
import {
  ParticipantId,
  ParticipantWeightHistoryId,
  PollId,
  UserId,
} from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { PollRevision } from '@/domain/poll/PollRevision';

function fixture() {
  let revision = 0;
  const createParticipant = vi.fn(
    async ({ data }: Prisma.PollParticipantCreateArgs) => ({
      ...data,
      id: data.id ?? 'database-id',
    })
  );
  const createHistory = vi.fn(
    async ({ data }: Prisma.ParticipantWeightHistoryCreateArgs) => data
  );
  const tx = {
    $queryRaw: vi.fn(async () => [{ id: 'poll-1' }]),
    poll: {
      findUniqueOrThrow: vi.fn(async () => ({ state: 'READY', revision })),
      update: vi.fn(async ({ data }: Prisma.PollUpdateArgs) => {
        revision +=
          typeof data.revision === 'object'
            ? (data.revision.increment ?? 0)
            : 0;

        return { revision };
      }),
    },
    vote: { count: vi.fn(async () => 0) },
    pollProperty: { deleteMany: vi.fn(async () => ({ count: 0 })) },
    pollParticipant: { create: createParticipant },
    participantWeightHistory: { create: createHistory },
  };
  const prisma = {
    $transaction: async (fn: (tx: unknown) => unknown) => fn(tx),
  } as unknown as PrismaClient;

  return {
    repository: new PrismaParticipantRepository(prisma),
    createParticipant,
    createHistory,
  };
}

it('persists caller identities and instants on reconfiguration additions', async () => {
  const { repository, createParticipant, createHistory } = fixture();
  const creation = testCreation(ParticipantId, 'participant-1');
  const historyCreation = testCreation(ParticipantWeightHistoryId, 'history-1');
  const result = await repository.applyWeightConfigChange(
    PollId.parse('poll-1'),
    'EQUAL',
    'RAW_SUM',
    [],
    [
      {
        userId: UserId.parse('user-1'),
        weight: VotingWeight.parse(1),
        creation,
        historyCreation,
      },
    ],
    [],
    [],
    UserId.parse('admin-1'),
    'Config changed',
    PollRevision.parse(0)
  );
  expect(result.success).toBe(true);
  expect(createParticipant.mock.calls[0][0].data).toMatchObject({
    id: creation.id,
    createdAt: new Date(creation.now),
  });
  expect(createHistory.mock.calls[0][0].data).toMatchObject({
    id: historyCreation.id,
    participantId: creation.id,
    changedAt: new Date(historyCreation.now),
  });
});

it('rejects a writer loaded before another weight configuration commit', async () => {
  const { repository } = fixture();
  const write = () =>
    repository.applyWeightConfigChange(
      PollId.parse('poll-1'),
      'EQUAL',
      'RAW_SUM',
      [],
      [],
      [],
      [],
      UserId.parse('admin-1'),
      'Config changed',
      PollRevision.parse(0)
    );
  expect((await write()).success).toBe(true);
  expect(await write()).toEqual({ success: false, error: 'domain.poll.stale' });
});
