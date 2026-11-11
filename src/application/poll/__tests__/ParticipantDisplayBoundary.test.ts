/** Poll administration reads user displays through core ports and returns only
 * approved display fields, never user credentials or private profile state. */
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { expect, it } from 'vitest';
import { GetParticipantsUseCase } from '../GetParticipantsUseCase';
import { success } from '@/domain/shared/Result';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { PollId, UserId, ParticipantId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { ParticipantWeightHistoryId } from '@/domain/shared/EntityIds';
import { ParticipantWeightHistory } from '@/domain/poll/ParticipantWeightHistory';
import { GetWeightHistoryUseCase } from '../GetWeightHistoryUseCase';

it('gets a participant display through UserRepository and exposes only display fields', async () => {
  const created = PollParticipant.create(
    PollId.parse('poll-1'),
    UserId.parse('user-1'),
    testCreation(ParticipantId, 'participant-1')
  );

  if (!created.success) {
    throw new Error(created.error);
  }

  const useCase = new GetParticipantsUseCase(
    {
      getPollById: async () =>
        success({ organizationId: 'org-1', canModifyParticipants: () => true }),
    } as any,
    { getParticipants: async () => success([created.value]) } as any,
    { pollHasVotes: async () => success(false) } as any,
    {} as any,
    {
      isSuperAdmin: async () => true,
      findById: async () => ({
        id: created.value.userId,
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        passwordHash: 'private',
      }),
    } as any
  );
  const result = await useCase.execute({
    pollId: 'poll-1',
    adminUserId: 'admin-1',
  });
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.participants[0].user).toEqual({
    id: created.value.userId,
    firstName: 'John',
    lastName: 'Doe',
    middleName: null,
  });
});

it('gets audit actors through UserRepository and projects only display fields', async () => {
  const created = ParticipantWeightHistory.create(
    ParticipantId.parse('participant-1'),
    PollId.parse('poll-1'),
    UserId.parse('user-1'),
    VotingWeight.parse(1),
    VotingWeight.parse(2),
    UserId.parse('admin-1'),
    testCreation(ParticipantWeightHistoryId, 'history-1')
  );

  if (!created.success) {
    throw new Error(created.error);
  }

  const useCase = new GetWeightHistoryUseCase(
    { getPollById: async () => success({ organizationId: 'org-1' }) } as any,
    { getWeightHistory: async () => success([created.value]) } as any,
    {} as any,
    {
      isSuperAdmin: async () => true,
      findById: async (id: string) => ({
        id,
        firstName: 'John',
        lastName: 'Doe',
        middleName: null,
        passwordHash: 'private',
      }),
    } as any
  );
  const result = await useCase.execute({
    pollId: 'poll-1',
    adminUserId: 'admin-1',
  });
  expect(result.success).toBe(true);

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.value.history[0].changedByUser).toEqual({
    id: 'admin-1',
    firstName: 'John',
    lastName: 'Doe',
    middleName: null,
  });
  expect(result.value.history[0].participantUser).toEqual({
    id: 'user-1',
    firstName: 'John',
    lastName: 'Doe',
    middleName: null,
  });
});
