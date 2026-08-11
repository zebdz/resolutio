import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SubmitPollToAdminUseCase } from '../SubmitPollToAdminUseCase';
import { ReturnPollToDraftUseCase } from '../ReturnPollToDraftUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Organization } from '../../../domain/organization/Organization';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { NotificationRepository } from '../../../domain/notification/NotificationRepository';
import { success } from '../../../domain/shared/Result';
import { PollState } from '../../../domain/poll/PollState';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { PollErrors } from '../PollErrors';

const AUTHOR = 'author-1';
const ADMIN = 'admin-1';
const OUTSIDER = 'nobody-1';

function makePoll(withQuestion = true): Poll {
  const poll = Poll.create(
    'Test Poll',
    'Test Description',
    'org-1',
    null,
    AUTHOR,
    new Date('2026-01-01'),
    new Date('2026-02-01')
  ).value;
  (poll as any).props.id = 'poll-1';

  if (withQuestion) {
    const question = Question.create(
      'Question 1',
      poll.id,
      1,
      1,
      'single-choice'
    ).value;
    question.addAnswer(Answer.create('Answer 1', 1, question.id).value);
    poll.addQuestion(question);
  }

  return poll;
}

describe('SubmitPollToAdminUseCase', () => {
  let poll: Poll;
  let pollRepository: Partial<PollRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let notificationRepository: Partial<NotificationRepository>;
  let useCase: SubmitPollToAdminUseCase;

  beforeEach(() => {
    poll = makePoll();

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
    };

    organizationRepository = {
      getAdminUserIds: vi.fn().mockResolvedValue([ADMIN, 'admin-2']),
      findById: vi.fn().mockResolvedValue(
        Organization.reconstitute({
          id: 'org-1',
          name: 'Test Org',
          description: 'desc',
          parentId: null,
          createdById: ADMIN,
          createdAt: new Date(),
          archivedAt: null,
          allowMultiTreeMembership: false,
        })
      ),
    };

    userRepository = { isSuperAdmin: vi.fn().mockResolvedValue(false) };
    notificationRepository = {
      saveBatch: vi.fn().mockResolvedValue(success(undefined)),
    };

    useCase = new SubmitPollToAdminUseCase(
      pollRepository as PollRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository,
      notificationRepository as NotificationRepository
    );
  });

  it('moves the poll to SUBMITTED for its author', async () => {
    const result = await useCase.execute({ pollId: 'poll-1', userId: AUTHOR });

    expect(result.success).toBe(true);
    expect(poll.state).toBe(PollState.SUBMITTED);
    expect(pollRepository.updatePoll).toHaveBeenCalled();
  });

  // Submitting records that the author considers the poll finished, so nobody
  // else can assert it on their behalf.
  it('refuses an org admin who did not write the poll', async () => {
    const result = await useCase.execute({ pollId: 'poll-1', userId: ADMIN });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
    expect(poll.state).toBe(PollState.DRAFT);
  });

  it('refuses an unrelated user', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: OUTSIDER,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
  });

  it('allows a superadmin acting for the author', async () => {
    userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({ pollId: 'poll-1', userId: ADMIN });

    expect(result.success).toBe(true);
    expect(poll.state).toBe(PollState.SUBMITTED);
  });

  it('refuses a poll with nothing to vote on', async () => {
    poll = makePoll(false);
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(poll));

    const result = await useCase.execute({ pollId: 'poll-1', userId: AUTHOR });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_NO_QUESTIONS);
  });

  it('notifies the org admins, but not the author', async () => {
    organizationRepository.getAdminUserIds = vi
      .fn()
      .mockResolvedValue([ADMIN, AUTHOR]);

    await useCase.execute({ pollId: 'poll-1', userId: AUTHOR });

    const saved = (notificationRepository.saveBatch as any).mock.calls[0][0];

    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe(ADMIN);
    expect(saved[0].type).toBe('poll_submitted');
  });

  it('refuses an archived organization', async () => {
    organizationRepository.findById = vi.fn().mockResolvedValue(
      Organization.reconstitute({
        id: 'org-1',
        name: 'Archived',
        description: 'desc',
        parentId: null,
        createdById: ADMIN,
        createdAt: new Date(),
        archivedAt: new Date(),
        allowMultiTreeMembership: false,
      })
    );

    const result = await useCase.execute({ pollId: 'poll-1', userId: AUTHOR });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.ORGANIZATION_ARCHIVED);
  });
});

describe('ReturnPollToDraftUseCase', () => {
  let poll: Poll;
  let pollRepository: Partial<PollRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let notificationRepository: Partial<NotificationRepository>;
  let useCase: ReturnPollToDraftUseCase;

  beforeEach(() => {
    poll = makePoll();
    poll.submitToAdmin();

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(false),
    };

    userRepository = { isSuperAdmin: vi.fn().mockResolvedValue(false) };
    notificationRepository = {
      saveBatch: vi.fn().mockResolvedValue(success(undefined)),
    };

    useCase = new ReturnPollToDraftUseCase(
      pollRepository as PollRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository,
      notificationRepository as NotificationRepository
    );
  });

  it('lets the author recall their own poll', async () => {
    const result = await useCase.execute({ pollId: 'poll-1', userId: AUTHOR });

    expect(result.success).toBe(true);
    expect(poll.state).toBe(PollState.DRAFT);
  });

  it('lets an org admin send it back for changes', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({ pollId: 'poll-1', userId: ADMIN });

    expect(result.success).toBe(true);
    expect(poll.state).toBe(PollState.DRAFT);
  });

  it('refuses anyone who is neither', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: OUTSIDER,
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
    expect(poll.state).toBe(PollState.SUBMITTED);
  });

  it('refuses once participants are frozen', async () => {
    poll.takeSnapshot();

    const result = await useCase.execute({ pollId: 'poll-1', userId: AUTHOR });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollDomainCodes.POLL_MUST_BE_SUBMITTED);
    expect(poll.state).toBe(PollState.READY);
  });

  it('tells the author when an admin hands the poll back', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(true);

    await useCase.execute({ pollId: 'poll-1', userId: ADMIN });

    const saved = (notificationRepository.saveBatch as any).mock.calls[0][0];

    expect(saved).toHaveLength(1);
    expect(saved[0].userId).toBe(AUTHOR);
    expect(saved[0].type).toBe('poll_returned_to_draft');
  });

  // An author recalling their own poll already knows they did it.
  it('sends nothing when the author recalls', async () => {
    await useCase.execute({ pollId: 'poll-1', userId: AUTHOR });

    expect(notificationRepository.saveBatch).not.toHaveBeenCalled();
  });
});
