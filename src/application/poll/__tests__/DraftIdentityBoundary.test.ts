/** Draft commands decode request identities and return an explicit removal result.
 * Saved drafts get their identity/time from application ports before persistence. */
import { expect, it, vi } from 'vitest';
import { SubmitDraftUseCase } from '../SubmitDraftUseCase';
import { success } from '@/domain/shared/Result';
import { Instant } from '@/domain/shared/Instant';
import { IdGenerator } from '@/application/shared/EntityCreation';
import { PollDomainCodes } from '@/domain/poll/PollDomainCodes';

function fixture() {
  const ids: IdGenerator = {
    generate: vi.fn((schema) => schema.parse('draft-1')),
  };
  const draftRepository = {
    deleteDraftByAnswer: vi.fn().mockResolvedValue(success(undefined)),
    deleteDraftsByQuestion: vi.fn().mockResolvedValue(success(undefined)),
    saveDraft: vi.fn(async (draft) => success(draft)),
  };
  const poll = {
    organizationId: 'org-1',
    boardId: null,
    isArchived: () => false,
    isActive: () => true,
    isFinished: () => false,
    isOpen: () => false,
    questions: [
      {
        id: 'q1',
        questionType: 'single-choice',
        isArchived: () => false,
        answers: [{ id: 'a1', isArchived: () => false }],
      },
    ],
  };
  const pollRepository = { getPollById: vi.fn(async () => success(poll)) };
  const useCase = new SubmitDraftUseCase(
    pollRepository as any,
    { getParticipantByUserAndPoll: async () => success({}) } as any,
    { hasUserFinishedVoting: async () => success(false) } as any,
    draftRepository as any,
    { findById: async () => null } as any,
    {} as any,
    {} as any,
    ids,
    { now: () => Instant.parse('2026-10-26T10:00:00.123Z') }
  );
  const input = {
    pollId: 'poll-1',
    userId: 'user-1',
    questionId: 'q1',
    answerId: 'a1',
    isSingleChoice: true,
  };

  return { ids, useCase, input, draftRepository, pollRepository, poll };
}

it('reports removal without inventing an unsaved draft or generating an identity', async () => {
  const f = fixture();
  expect(await f.useCase.execute({ ...f.input, shouldRemove: true })).toEqual(
    success({ kind: 'removed' })
  );
  expect(f.ids.generate).not.toHaveBeenCalled();
  expect(f.draftRepository.saveDraft).not.toHaveBeenCalled();
});

it('persists the supplied draft identity and exact clock instant', async () => {
  const f = fixture();
  const result = await f.useCase.execute(f.input);
  expect(result.success).toBe(true);

  if (!result.success || result.value.kind !== 'saved') {
    throw new Error('Expected saved draft');
  }

  expect(result.value.draft.id).toBe('draft-1');
  expect(result.value.draft.createdAt.toISOString()).toBe(
    '2026-10-26T10:00:00.123Z'
  );
});

it('rejects foreign selections before deleting or saving any draft', async () => {
  const f = fixture();
  expect(
    await f.useCase.execute({ ...f.input, answerId: 'foreign-answer' })
  ).toEqual({ success: false, error: PollDomainCodes.INVALID_BALLOT });
  expect(f.draftRepository.deleteDraftsByQuestion).not.toHaveBeenCalled();
  expect(f.draftRepository.saveDraft).not.toHaveBeenCalled();
});

it('uses the saved question cardinality instead of the client hint', async () => {
  const f = fixture();
  expect(
    (await f.useCase.execute({ ...f.input, isSingleChoice: false })).success
  ).toBe(true);
  expect(f.draftRepository.deleteDraftsByQuestion).toHaveBeenCalledOnce();
});
