/** Direct action clients exercise form decoding and authorized plain poll reads.
 * Real domain snapshots catch unsafe serialization; mocked ports prevent external I/O. */
import { beforeEach, expect, it, vi } from 'vitest';
import { Poll } from '@/domain/poll/Poll';
import { PollState } from '@/domain/poll/PollState';
import { UserId } from '@/domain/shared/EntityIds';
import { success } from '@/domain/shared/Result';

const mocks = vi.hoisted(() => ({
  addQuestion: vi.fn(),
  createPoll: vi.fn(),
  updatePoll: vi.fn(),
  currentUser: vi.fn(),
  rateLimit: vi.fn(),
  getPoll: vi.fn(),
  getUserPolls: vi.fn(),
  getBoardPolls: vi.fn(),
  searchPolls: vi.fn(),
  isSuperAdmin: vi.fn(),
  isMember: vi.fn(),
  isAdmin: vi.fn(),
  isBoardMember: vi.fn(),
  adminOrgs: vi.fn(),
  participant: vi.fn(),
  votes: vi.fn(),
  organization: vi.fn(),
  board: vi.fn(),
}));
vi.mock('@/application/poll/AddQuestionUseCase', () => ({
  AddQuestionUseCase: class {
    execute = mocks.addQuestion;
  },
}));
vi.mock('@/application/poll/CreatePollUseCase', () => ({
  CreatePollUseCase: class {
    execute = mocks.createPoll;
  },
}));
vi.mock('@/application/poll/UpdatePollUseCase', () => ({
  UpdatePollUseCase: class {
    execute = mocks.updatePoll;
  },
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {
    pollParticipant: { findFirst: mocks.participant },
    vote: { count: mocks.votes },
    organization: { findUnique: mocks.organization },
    board: { findUnique: mocks.board },
  },
  PrismaPollRepository: class {
    getPollById = mocks.getPoll;
    getPollsByUserId = mocks.getUserPolls;
    getPollsByBoardId = mocks.getBoardPolls;
    searchPolls = mocks.searchPolls;
  },
  PrismaOrganizationRepository: class {
    isUserMember = mocks.isMember;
    isUserAdmin = mocks.isAdmin;
    findAdminOrganizationsByUserId = mocks.adminOrgs;
  },
  PrismaUserRepository: class {
    isSuperAdmin = mocks.isSuperAdmin;
  },
  PrismaBoardRepository: class {
    isUserMember = mocks.isBoardMember;
  },
  PrismaParticipantRepository: class {},
  PrismaVoteRepository: class {},
  PrismaQuestionRepository: class {},
  PrismaAnswerRepository: class {},
  PrismaDraftRepository: class {},
  PrismaNotificationRepository: class {},
  PrismaPropertyAssetRepository: class {},
  PrismaPollEligibleMemberRepository: class {},
  PrismaOrganizationPropertyRepository: class {},
}));
vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: {
    getInstance: () => ({ containsProfanity: () => false }),
  },
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.currentUser }));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
const {
  addQuestionAction,
  createPollAction,
  updatePollAction,
  getPollByIdAction,
  getUserPollsAction,
  getPollsByBoardIdAction,
  searchPollsAction,
} = await import('../poll/poll');

function questionForm() {
  const form = new FormData();

  for (const [key, value] of Object.entries({
    pollId: 'poll',
    text: 'Agree?',
    details: '',
    page: '1',
    order: '0',
    questionType: 'single-choice',
    answers: JSON.stringify([' Yes ', '', 'No']),
  })) {
    form.set(key, value);
  }

  return form;
}

function pollForm() {
  const form = new FormData();

  for (const [key, value] of Object.entries({
    pollId: 'poll',
    title: 'A poll',
    description: 'Description',
    organizationId: 'org',
    startDate: '2026-01-01',
    endDate: '2026-02-01',
  })) {
    form.set(key, value);
  }

  return form;
}

function poll() {
  return Poll.reconstitute({
    id: 'poll',
    title: 'A poll',
    description: 'Description',
    organizationId: 'org',
    boardId: null,
    pollType: 'OPEN',
    state: PollState.DRAFT,
    startDate: new Date('2026-01-01'),
    endDate: new Date('2026-02-01'),
    weightCriteria: null,
    distributionType: 'EQUAL',
    propertyAggregation: 'RAW_SUM',
    propertyIds: [],
    anonymous: false,
    createdBy: 'creator',
    createdAt: new Date('2026-01-01'),
    archivedAt: null,
    questions: [],
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.currentUser.mockResolvedValue({ id: UserId.parse('viewer') });
  mocks.rateLimit.mockResolvedValue(null);
  mocks.addQuestion.mockResolvedValue(success({ id: 'question' }));
  mocks.createPoll.mockResolvedValue(success({ id: 'poll' }));
  mocks.updatePoll.mockResolvedValue(success(undefined));
  mocks.getPoll.mockResolvedValue(success(poll()));
  mocks.getUserPolls.mockResolvedValue(success([poll()]));
  mocks.getBoardPolls.mockResolvedValue(success([poll()]));
  mocks.searchPolls.mockResolvedValue(
    success({ polls: [poll()], totalCount: 1 })
  );
  mocks.isSuperAdmin.mockResolvedValue(false);
  mocks.isMember.mockResolvedValue(false);
  mocks.isAdmin.mockResolvedValue(false);
  mocks.isBoardMember.mockResolvedValue(true);
  mocks.adminOrgs.mockResolvedValue([]);
  mocks.participant.mockResolvedValue(null);
  mocks.votes.mockResolvedValue(0);
  mocks.organization.mockResolvedValue({ name: 'Community', archivedAt: null });
  mocks.board.mockResolvedValue(null);
});

it.each([
  ['page', '1.5'],
  ['page', '1junk'],
  ['order', '1.5'],
  ['order', '1junk'],
])('rejects malformed %s %s instead of truncating it', async (key, value) => {
  const form = questionForm();
  form.set(key, value);
  const result = await addQuestionAction(form);
  expect(result.success).toBe(false);
  expect(mocks.addQuestion).not.toHaveBeenCalled();
});

it('preserves valid page/order and trims nonempty answers', async () => {
  expect(await addQuestionAction(questionForm())).toEqual({
    success: true,
    data: { questionId: 'question' },
  });
  expect(mocks.addQuestion).toHaveBeenCalledWith(
    expect.objectContaining({
      page: 1,
      order: 0,
      answers: ['Yes', 'No'],
      userId: 'viewer',
    })
  );
});

it('returns a plain open-poll detail to an authenticated link reader', async () => {
  const result = await getPollByIdAction('poll');
  expect(result).toEqual({ success: true, data: poll().toJSON() });

  if (!result.success) {
    throw new Error(result.error);
  }

  expect(Object.getPrototypeOf(result.data) === Object.prototype).toBe(true);
});

it('preserves user-list status and open-poll search status', async () => {
  const userResult = await getUserPollsAction();
  const searchResult = await searchPollsAction({});

  if (!userResult.success || !searchResult.success) {
    throw new Error('Expected authorized reads');
  }

  expect(userResult.data[0]).toEqual({
    ...poll().toJSON(),
    canVote: false,
    hasFinishedVoting: false,
  });
  expect(searchResult.data).toEqual({
    totalCount: 1,
    polls: [
      {
        ...poll().toJSON(),
        canVote: true,
        hasFinishedVoting: false,
        organizationName: 'Community',
        isOrgArchived: false,
        boardName: '',
        isBoardArchived: false,
      },
    ],
  });
});

it('denies a board read without membership before loading polls', async () => {
  mocks.isBoardMember.mockResolvedValue(false);
  expect(await getPollsByBoardIdAction('board')).toEqual({
    success: false,
    error: 'translated:board.errors.notMember',
  });
  expect(mocks.getBoardPolls).not.toHaveBeenCalled();
});

it.each([
  ['create', createPollAction],
  ['update', updatePollAction],
] as const)(
  '%s rejects a missing start date instead of treating it as the Unix epoch',
  async (_name, action) => {
    const form = pollForm();
    form.delete('startDate');
    expect(await action(form)).toMatchObject({
      success: false,
      fieldErrors: { startDate: ['poll.invalidDates'] },
    });
    expect(mocks.createPoll).not.toHaveBeenCalled();
    expect(mocks.updatePoll).not.toHaveBeenCalled();
  }
);

it('reports invalid property JSON as a field-validation error', async () => {
  const form = pollForm();
  form.set('propertyIds', '[broken');
  const result = await createPollAction(form);
  expect(result).toMatchObject({
    success: false,
    error: 'validationFailed',
    fieldErrors: { propertyIds: ['poll.propertyNotInOrg'] },
  });
  expect(mocks.createPoll).not.toHaveBeenCalled();
});

it('rejects a file in optional question details through field validation', async () => {
  const form = questionForm();
  form.set('details', new Blob(['details']), 'details.txt');
  expect(await addQuestionAction(form)).toMatchObject({
    success: false,
    error: 'validationFailed',
    fieldErrors: { details: ['poll.questionInvalidData'] },
  });
  expect(mocks.addQuestion).not.toHaveBeenCalled();
});
