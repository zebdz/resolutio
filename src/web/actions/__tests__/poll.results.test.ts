/** Direct action callers receive only the authorized, serializable results view.
 * Page-level filtering must never be the protection for voter identities or phone consent. */
import { beforeEach, expect, it, vi } from 'vitest';
import { Poll } from '@/domain/poll/Poll';
import { PollState } from '@/domain/poll/PollState';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { AnswerId, QuestionId, UserId } from '@/domain/shared/EntityIds';
import { AnswerText, QuestionText } from '@/domain/poll/QuestionValues';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import {
  ParticipantCount,
  TotalVotingWeight,
  VoteCount,
  VotingPercentage,
} from '@/domain/poll/ResultTallies';
import type { GetPollResultsResult } from '@/application/poll/GetPollResultsUseCase';

const { execute, currentUser, rateLimit } = vi.hoisted(() => ({
  execute: vi.fn(),
  currentUser: vi.fn(),
  rateLimit: vi.fn(),
}));
vi.mock('@/application/poll/GetPollResultsUseCase', () => ({
  GetPollResultsUseCase: class {
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
const { getPollResultsAction } = await import('../poll/vote');

function results(names = false, signers = false): GetPollResultsResult {
  const userId = UserId.parse('private-voter');

  return {
    poll: Poll.reconstitute({
      id: 'poll-1',
      title: 'A poll',
      description: 'Description',
      organizationId: 'org-1',
      boardId: null,
      pollType: 'ORGANIZATION',
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-02-01'),
      state: PollState.FINISHED,
      finishedAt: new Date('2026-02-01'),
      weightCriteria: null,
      distributionType: 'EQUAL',
      propertyAggregation: 'RAW_SUM',
      propertyIds: [],
      anonymous: !names,
      createdBy: 'creator',
      createdAt: new Date('2026-01-01'),
      archivedAt: null,
      questions: [],
    }),
    results: [
      {
        questionId: QuestionId.parse('question-1'),
        questionText: QuestionText.parse('A question'),
        questionDetails: null,
        questionType: 'multiple-choice',
        totalVotes: VoteCount.parse(2),
        participantWeight: TotalVotingWeight.parse(2),
        answers: ['answer-1', 'answer-2'].map((id) => ({
          answerId: AnswerId.parse(id),
          answerText: AnswerText.parse('An answer'),
          voteCount: VoteCount.parse(1),
          totalWeight: TotalVotingWeight.parse(2),
          percentage: VotingPercentage.parse(50),
          voters: [
            {
              userId,
              userName: {
                firstName: 'Private',
                lastName: 'Person',
                middleName: null,
              },
              weight: VotingWeight.parse(2),
            },
          ],
        })),
      },
    ],
    totalParticipants: ParticipantCount.parse(2),
    totalParticipantWeight: TotalVotingWeight.parse(4),
    canViewVoterNames: names,
    canViewSignWillingness: signers,
    viewerFacts: { isAdmin: signers, isOrgMember: true, isPollVoter: true },
    protocolSignWillingness: [
      {
        userId,
        firstName: 'Private',
        lastName: 'Person',
        middleName: null,
        willingToSignProtocol: true,
        phoneNumber: PhoneNumber.create('+79001234567'),
      },
    ],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  rateLimit.mockResolvedValue(null);
  currentUser.mockResolvedValue({ id: UserId.parse('viewer') });
});

it('removes voter details and signing contacts before returning to a direct caller', async () => {
  execute.mockResolvedValue({ success: true, value: results() });
  const result = await getPollResultsAction('poll-1');
  expect(result.success).toBe(true);
  expect(JSON.stringify(result)).not.toContain('private-voter');
  expect(JSON.stringify(result)).not.toContain('Private');
  expect(JSON.stringify(result)).not.toContain('+79001234567');
});

it('preserves anonymous totals without exposing aggregates or authorization facts', async () => {
  execute.mockResolvedValue({ success: true, value: results() });
  const result = await getPollResultsAction('poll-1');

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(Object.keys(result.data).sort()).toEqual([
    'canViewSignWillingness',
    'canViewVoterNames',
    'results',
  ]);
  expect(result.data.results).toMatchObject({
    pollId: 'poll-1',
    totalParticipants: 2,
    totalWeight: 4,
    votedParticipants: 1,
    questions: [
      {
        totalVotes: 2,
        totalWeight: 4,
        participantWeight: 2,
        answers: [
          { weightedVotes: 2, voters: [] },
          { weightedVotes: 2, voters: [] },
        ],
      },
    ],
    protocolSignWillingness: [],
  });
  expect(JSON.stringify(result)).not.toContain('viewerFacts');
  expect(JSON.parse(JSON.stringify(result.data))).toEqual(result.data);
});

it('exposes permitted voter names while keeping signing contacts admin-only', async () => {
  execute.mockResolvedValue({ success: true, value: results(true, false) });
  const result = await getPollResultsAction('poll-1');

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.data.results.questions[0].answers[0].voters).toEqual([
    { userId: 'private-voter', userName: 'Person Private', weight: 2 },
  ]);
  expect(result.data.results.protocolSignWillingness).toEqual([]);
  expect(JSON.stringify(result)).not.toContain('+79001234567');
});

it('serializes consenting phone numbers only for an authorized admin', async () => {
  execute.mockResolvedValue({ success: true, value: results(true, true) });
  const result = await getPollResultsAction('poll-1');

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(result.data.results.protocolSignWillingness[0].phoneNumber).toBe(
    '+79001234567'
  );
  expect(JSON.parse(JSON.stringify(result.data))).toEqual(result.data);
});

it('checks rate limits and authentication before loading results', async () => {
  rateLimit.mockResolvedValueOnce({ success: false, error: 'limited' });
  expect(await getPollResultsAction('poll-1')).toEqual({
    success: false,
    error: 'limited',
  });
  expect(currentUser).not.toHaveBeenCalled();
  expect(execute).not.toHaveBeenCalled();
  currentUser.mockResolvedValue(null);
  expect(await getPollResultsAction('poll-1')).toEqual({
    success: false,
    error: 'unauthorized',
  });
  expect(execute).not.toHaveBeenCalled();
});
