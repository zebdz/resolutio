/** Participant commands reject malformed identities before repository access.
 * Audit creation is validated before any participant write can take place. */
import { expect, it, vi } from 'vitest';
import { UpdateParticipantWeightUseCase } from '../UpdateParticipantWeightUseCase';
import { PollParticipant } from '@/domain/poll/PollParticipant';
import { PollId, UserId, ParticipantId } from '@/domain/shared/EntityIds';
import { testCreation } from '@/domain/shared/__tests__/creation';
import { createQuestionIds, questionClock } from './questionTestValues';
import { success } from '@/domain/shared/Result';
import { SharedDomainCodes } from '@/domain/shared/SharedDomainCodes';
import { RemoveParticipantUseCase } from '../RemoveParticipantUseCase';
import { GetUserVotingProgressUseCase } from '../GetUserVotingProgressUseCase';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';

it('rejects an invalid participant identity before removal lookup', async () => {
  const participants = { getParticipantById: vi.fn(async () => success(null)) };
  const useCase = new RemoveParticipantUseCase(
    {} as any,
    participants as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
  expect(
    await useCase.execute({ participantId: '', adminUserId: 'admin-1' })
  ).toEqual({ success: false, error: PollDomainCodes.INVALID_BALLOT });
  expect(participants.getParticipantById).not.toHaveBeenCalled();
});

it('rejects an invalid poll identity before progress lookup', async () => {
  const polls = { getPollById: vi.fn(async () => success(null)) };
  const useCase = new GetUserVotingProgressUseCase(
    polls as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any,
    {} as any
  );
  expect(await useCase.execute({ pollId: '', userId: 'user-1' })).toEqual({
    success: false,
    error: PollDomainCodes.INVALID_BALLOT,
  });
  expect(polls.getPollById).not.toHaveBeenCalled();
});

it('rejects an invalid audit reason before persisting the changed weight', async () => {
  const created = PollParticipant.create(
    PollId.parse('poll-1'),
    UserId.parse('user-1'),
    testCreation(ParticipantId, 'participant-1')
  );

  if (!created.success) {
    throw new Error(created.error);
  }

  const participants = {
    getParticipantById: vi.fn(async () => success(created.value)),
    updateParticipantWeight: vi.fn(async () => success(undefined)),
    createWeightHistory: vi.fn(async (history) => success(history)),
  };
  const useCase = new UpdateParticipantWeightUseCase(
    {
      getPollById: async () =>
        success({
          organizationId: 'org-1',
          boardId: null,
          isOpen: () => false,
        }),
    } as any,
    participants as any,
    { pollHasVotes: async () => success(false) } as any,
    { findById: async () => null } as any,
    { isSuperAdmin: async () => true } as any,
    {} as any,
    createQuestionIds(),
    questionClock,
    { containsProfanity: () => true, findProfaneWords: () => [] }
  );
  expect(
    await useCase.execute({
      participantId: created.value.id,
      adminUserId: 'admin-1',
      newWeight: 2,
      reason: 'invalid',
    })
  ).toEqual({ success: false, error: SharedDomainCodes.CONTAINS_PROFANITY });
  expect(participants.updateParticipantWeight).not.toHaveBeenCalled();
  expect(participants.createWeightHistory).not.toHaveBeenCalled();
});
