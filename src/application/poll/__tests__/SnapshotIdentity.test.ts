import { ParticipantRepository } from '@/domain/poll/ParticipantRepository';
import { PollEligibleMemberRepository } from '@/domain/poll/PollEligibleMemberRepository';
/** Snapshot creation assigns all references before persistence, so history
 * links to its participant independently of insertion order or database IDs. */
import { expect, it, vi } from 'vitest';
import { TakeSnapshotUseCase } from '../TakeSnapshotUseCase';
import { Poll } from '@/domain/poll/Poll';
import { PollId, OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { success } from '@/domain/shared/Result';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { IdGenerator } from '@/application/shared/EntityCreation';

it('assigns participant and history identities using one snapshot instant', async () => {
  const pollId = PollId.parse('poll-1');
  const userId = UserId.parse('user-1');
  const now = Instant.parse('2026-01-01T00:00:00.000Z');
  const poll = {
    id: pollId,
    organizationId: OrganizationId.parse('org-1'),
    boardId: null,
    distributionType: 'EQUAL',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [],
    takeSnapshot: () => success(undefined),
    isOpen: () => false,
  } as unknown as Poll;
  const save = vi.fn<ParticipantRepository['executeActivation']>(async () =>
    success([])
  );
  const eligible = vi.fn<PollEligibleMemberRepository['createMany']>(async () =>
    success(undefined)
  );
  let next = 0;
  const ids: IdGenerator = {
    generate: (schema) => schema.parse(`assigned-${++next}`),
  };
  const useCase = new TakeSnapshotUseCase(
    { getPollById: async () => success(poll) } as never,
    { executeActivation: save } as never,
    null!,
    {
      findById: async () => null,
      findAcceptedMemberUserIdsIncludingDescendants: async () => [userId],
    } as never,
    { isSuperAdmin: async () => true } as never,
    { createMany: eligible } as never,
    {
      compute: async () => success(new Map([[userId, VotingWeight.parse(1)]])),
    } as never,
    ids,
    { now: () => now }
  );
  expect(await useCase.execute({ pollId, userId })).toEqual(success(undefined));
  const [, participants, history] = save.mock.calls[0];
  expect(participants[0].id).toBe('assigned-2');
  expect(history[0].participantId).toBe(participants[0].id);
  expect(history[0].id).toBe('assigned-3');
  expect(history[0].changedAt.toISOString()).toBe(now);
  expect(eligible.mock.calls[0][0][0].createdAt.toISOString()).toBe(now);
});
