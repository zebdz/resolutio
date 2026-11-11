/** Voting progress actions preserve authorization failures and return only plain nested DTOs.
 * Real aggregates expose accidental class/extra-field returns that loose fixtures would hide. */
import { beforeEach, expect, it, vi } from 'vitest';
import { Poll } from '@/domain/poll/Poll';
import { Question } from '@/domain/poll/Question';
import { Answer } from '@/domain/poll/Answer';
import { VoteDraft } from '@/domain/poll/VoteDraft';
import { PollState } from '@/domain/poll/PollState';
import { QuestionCount } from '@/domain/poll/QuestionValues';
import type { GetUserVotingProgressResult } from '@/application/poll/GetUserVotingProgressUseCase';

const { execute, currentUser, rateLimit } = vi.hoisted(() => ({
  execute: vi.fn(),
  currentUser: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock('@/application/poll/GetUserVotingProgressUseCase', () => ({
  GetUserVotingProgressUseCase: class {
    execute = execute;
  },
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaPollRepository: class {},
  PrismaParticipantRepository: class {},
  PrismaVoteRepository: class {},
  PrismaDraftRepository: class {},
  PrismaOrganizationRepository: class {},
  PrismaBoardRepository: class {},
  PrismaUserRepository: class {},
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: currentUser }));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: rateLimit }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
const { getUserVotingProgressAction } = await import('../poll/vote');

function progress(anonymous = false): GetUserVotingProgressResult {
  const createdAt = new Date('2026-01-01');
  const answer = Answer.reconstitute({
    id: 'answer-1',
    questionId: 'question-1',
    text: 'Yes',
    order: 0,
    createdAt,
    archivedAt: null,
  });
  const question = Question.reconstitute({
    id: 'question-1',
    pollId: 'poll-1',
    text: 'Agree?',
    details: null,
    page: 1,
    order: 0,
    questionType: 'single-choice',
    createdAt,
    archivedAt: null,
    answers: [answer],
  });
  const poll = Poll.reconstitute({
    id: 'poll-1',
    title: 'A poll',
    description: 'Description',
    organizationId: 'org-1',
    boardId: null,
    pollType: 'ORGANIZATION',
    startDate: createdAt,
    endDate: new Date('2026-02-01'),
    state: PollState.ACTIVE,
    weightCriteria: null,
    distributionType: 'EQUAL',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [],
    anonymous,
    createdBy: 'creator',
    createdAt,
    archivedAt: null,
    questions: [question],
    attachmentIds: ['attachment-1'],
  });
  const draft = VoteDraft.reconstitute({
    id: 'draft-1',
    pollId: poll.id,
    userId: 'viewer',
    questionId: question.id,
    answerId: answer.id,
    createdAt,
    updatedAt: createdAt,
  });

  return {
    poll,
    drafts: [draft],
    hasFinished: false,
    canVote: true,
    answeredQuestionIds: [question.id],
    totalQuestions: QuestionCount.parse(1),
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  currentUser.mockResolvedValue({ id: 'viewer' });
  rateLimit.mockResolvedValue(null);
});

it('returns a minimal plain poll, nested answers and the session user’s drafts', async () => {
  execute.mockResolvedValue({ success: true, value: progress() });
  const result = await getUserVotingProgressAction('poll-1');

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(Object.getPrototypeOf(result.data.poll) === Object.prototype).toBe(
    true
  );
  expect(
    Object.getPrototypeOf(result.data.poll.questions[0]) === Object.prototype
  ).toBe(true);
  expect(
    Object.getPrototypeOf(result.data.poll.questions[0].answers[0]) ===
      Object.prototype
  ).toBe(true);
  expect(
    Object.getPrototypeOf(result.data.drafts[0]) === Object.prototype
  ).toBe(true);
  expect(result.data.drafts).toEqual([
    { id: 'draft-1', questionId: 'question-1', answerId: 'answer-1' },
  ]);
  expect(result.data.poll).not.toHaveProperty('createdBy');
  expect(result.data.poll).toMatchObject({
    attachmentIds: ['attachment-1'],
    isPropertyBased: false,
  });
  expect(JSON.parse(JSON.stringify(result.data))).toStrictEqual(result.data);
  expect(execute).toHaveBeenCalledWith({ pollId: 'poll-1', userId: 'viewer' });
});

it('preserves the anonymous-poll notice flag from the aggregate', async () => {
  execute.mockResolvedValue({ success: true, value: progress(true) });
  const result = await getUserVotingProgressAction('poll-1');

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.data.poll.anonymous).toBe(true);
});

it('returns a translated access denial without serializing progress', async () => {
  execute.mockResolvedValue({
    success: false,
    error: 'poll.errors.notOrgMember',
  });
  expect(await getUserVotingProgressAction('poll-1')).toEqual({
    success: false,
    error: 'translated:poll.errors.notOrgMember',
  });
});

it('requires a session before loading progress', async () => {
  currentUser.mockResolvedValue(null);
  expect(await getUserVotingProgressAction('poll-1')).toEqual({
    success: false,
    error: 'unauthorized',
  });
  expect(execute).not.toHaveBeenCalled();
});
