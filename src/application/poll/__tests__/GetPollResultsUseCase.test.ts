import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetPollResultsUseCase } from '../GetPollResultsUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollState } from '../../../domain/poll/PollState';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Vote } from '../../../domain/poll/Vote';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { VoteRepository } from '../../../domain/poll/VoteRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { Result, success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { Decimal } from 'decimal.js';
import { User } from '../../../domain/user/User';
import { PhoneNumber } from '../../../domain/user/PhoneNumber';

describe('GetPollResultsUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let voteRepository: Partial<VoteRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let useCase: GetPollResultsUseCase;
  let poll: Poll;
  let question: Question;
  let answer1: Answer;
  let answer2: Answer;
  let participant1: PollParticipant;
  let participant2: PollParticipant;
  let vote1: Vote;
  let vote2: Vote;

  beforeEach(() => {
    // Create a poll
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      'board-1',
      'user-1',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    );
    expect(pollResult.success).toBe(true);
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';
    // Set state directly to FINISHED (questions added to props below)
    (poll as any).props.state = PollState.FINISHED;

    // Create question
    const questionResult = Question.create(
      'Test Question',
      'poll-1',
      1,
      0,
      'single-choice'
    );
    expect(questionResult.success).toBe(true);
    question = questionResult.value;
    (question as any).props.id = 'question-1';
    (poll as any).props.questions = [question];

    // Create answers
    const answer1Result = Answer.create('Answer 1', 1, 'question-1');
    expect(answer1Result.success).toBe(true);
    answer1 = answer1Result.value;
    (answer1 as any).props.id = 'answer-1';

    const answer2Result = Answer.create('Answer 2', 2, 'question-1');
    expect(answer2Result.success).toBe(true);
    answer2 = answer2Result.value;
    (answer2 as any).props.id = 'answer-2';
    (question as any).props.answers = [answer1, answer2];

    // Create participants
    const participant1Result = PollParticipant.create(
      'poll-1',
      'user-1',
      new Decimal(2.0).toNumber()
    );
    expect(participant1Result.success).toBe(true);
    participant1 = participant1Result.value;
    (participant1 as any).props.id = 'participant-1';

    const participant2Result = PollParticipant.create(
      'poll-1',
      'user-2',
      new Decimal(3.0).toNumber()
    );
    expect(participant2Result.success).toBe(true);
    participant2 = participant2Result.value;
    (participant2 as any).props.id = 'participant-2';

    // Create votes
    const vote1Result = Vote.create(
      'question-1',
      'answer-1',
      'user-1',
      new Decimal(2.0).toNumber()
    );
    expect(vote1Result.success).toBe(true);
    vote1 = vote1Result.value;

    const vote2Result = Vote.create(
      'question-1',
      'answer-2',
      'user-2',
      new Decimal(3.0).toNumber()
    );
    expect(vote2Result.success).toBe(true);
    vote2 = vote2Result.value;

    // Mock repositories
    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      getParticipants: vi
        .fn()
        .mockResolvedValue(success([participant1, participant2])),
      // The policy needs isPollVoter for every viewer now, not just open-poll
      // outsiders, so this lookup always runs.
      getParticipantByUserAndPoll: vi.fn().mockResolvedValue(success(null)),
    };

    voteRepository = {
      getVotesByPoll: vi.fn().mockResolvedValue(success([vote1, vote2])),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      isUserMember: vi.fn().mockResolvedValue(true),
    };

    userRepository = {
      findByIds: vi.fn().mockResolvedValue([
        User.reconstitute({
          id: 'user-1',
          firstName: 'Alice',
          lastName: 'Smith',
          phoneNumber: PhoneNumber.create('+79001234567'),
          password: 'hashed',
          language: 'ru',
          createdAt: new Date(),
        }),
        User.reconstitute({
          id: 'user-2',
          firstName: 'Bob',
          lastName: 'Johnson',
          phoneNumber: PhoneNumber.create('+79007654321'),
          password: 'hashed',
          language: 'ru',
          createdAt: new Date(),
        }),
      ]),
      isSuperAdmin: vi.fn((userId) =>
        Promise.resolve(userId === 'user-superadmin')
      ),
    };

    useCase = new GetPollResultsUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      voteRepository as VoteRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository
    );
  });

  it('should calculate weighted vote results correctly', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const questionResult = result.value.results[0];
      const answer1Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-1'
      );
      const answer2Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-2'
      );

      expect(answer1Result?.totalWeight).toBe(2.0);
      expect(answer2Result?.totalWeight).toBe(3.0);
      expect(answer1Result?.percentage).toBe(40); // 2 / 5 * 100
      expect(answer2Result?.percentage).toBe(60); // 3 / 5 * 100
    }
  });

  it('should include voter breakdown for admins', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.canViewVoterNames).toBe(true);
      const answer1Result = result.value.results[0].answers.find(
        (a) => a.answerId === 'answer-1'
      );
      expect(answer1Result?.voters.length).toBe(1);
      expect(answer1Result?.voters[0].userId).toBe('user-1');
      expect(answer1Result?.voters[0].weight).toBe(2.0);
    }
  });

  it('should allow admin to view results of active poll', async () => {
    // Make poll active but not finished
    (poll as any).props.state = PollState.ACTIVE;

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);
  });

  it('should reject non-admin viewing results of an active anonymous poll', async () => {
    // Make poll active but not finished
    (poll as any).props.state = PollState.ACTIVE;
    (poll as any).props.anonymous = true;
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-member',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
    }
  });

  it('should allow a member to view results of an active named poll', async () => {
    (poll as any).props.state = PollState.ACTIVE;
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-member',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.canViewVoterNames).toBe(true);
      // Phone numbers ride along with sign-willingness under a separate
      // consent, so they stay admin-only even on a named poll.
      expect(result.value.canViewSignWillingness).toBe(false);
      expect(result.value.protocolSignWillingness).toEqual([]);
    }
  });

  it('should allow superadmin to view results of active poll', async () => {
    // Make poll active but not finished
    (poll as any).props.state = PollState.ACTIVE;
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-superadmin',
    });

    expect(result.success).toBe(true);
  });

  it('should allow organization members to view results of finished poll', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-member',
    });

    expect(result.success).toBe(true);
  });

  it('SECURITY: should NOT allow non-creators to view voter breakdown of an anonymous poll', async () => {
    // Non-admin, non-creator user
    (poll as any).props.anonymous = true;
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-2',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.canViewVoterNames).toBe(false);
    }
  });

  it('SECURITY: should NOT allow poll creator to view voter breakdown of an anonymous poll', async () => {
    (poll as any).props.anonymous = true;
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-1', // This is the creator
    });

    expect(result.success).toBe(true);

    if (result.success) {
      // Creating a poll is not a licence to read its ballots.
      expect(result.value.canViewVoterNames).toBe(false);
    }
  });

  it('SECURITY: should NOT leak sign-willingness to a member of a named poll', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-2',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      // Names open up on a named poll; the phone numbers behind
      // sign-willingness do not.
      expect(result.value.canViewVoterNames).toBe(true);
      expect(result.value.canViewSignWillingness).toBe(false);
      expect(result.value.protocolSignWillingness).toEqual([]);
    }
  });

  it('SECURITY: should allow admins to view voter breakdown', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(true);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.canViewVoterNames).toBe(true);
      expect(result.value.canViewSignWillingness).toBe(true);
    }
  });

  it('should reject non-members viewing results of finished poll', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-outsider',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
    }
  });

  it('should reject when poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'user-admin',
    });

    expect(result.success).toBe(false);

    if (!result.success) {
      expect(result.error).toBe(PollErrors.NOT_FOUND);
    }
  });

  it('should handle zero weight correctly', async () => {
    // Create participant with zero weight
    const participant3Result = PollParticipant.create(
      'poll-1',
      'user-3',
      new Decimal(0).toNumber()
    );
    expect(participant3Result.success).toBe(true);
    const participant3 = participant3Result.value;
    (participant3 as any).props.id = 'participant-3';

    participantRepository.getParticipants = vi
      .fn()
      .mockResolvedValue(success([participant1, participant2, participant3]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.totalParticipants).toBe(3);
      expect(result.value.totalParticipantWeight).toBe(5.0);
    }
  });

  it('should handle poll with no votes', async () => {
    voteRepository.getVotesByPoll = vi.fn().mockResolvedValue(success([]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const questionResult = result.value.results[0];
      expect(questionResult.totalVotes).toBe(0);
      questionResult.answers.forEach((answer) => {
        expect(answer.voteCount).toBe(0);
        expect(answer.totalWeight).toBe(0);
        expect(answer.percentage).toBe(0);
      });
    }
  });

  it('should exclude archived questions from results', async () => {
    // Add archived question
    const archivedQuestionResult = Question.create(
      'Archived Question',
      'poll-1',
      2,
      0,
      'single-choice'
    );
    expect(archivedQuestionResult.success).toBe(true);
    const archivedQuestion = archivedQuestionResult.value;
    (archivedQuestion as any).props.id = 'question-2';
    archivedQuestion.archive();
    (poll as any).props.questions = [question, archivedQuestion];

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.results.length).toBe(1);
      expect(result.value.results[0].questionId).toBe('question-1');
    }
  });

  it('should exclude archived answers from results', async () => {
    // Archive answer2
    answer2.archive();

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const questionResult = result.value.results[0];
      expect(questionResult.answers.length).toBe(1);
      expect(questionResult.answers[0].answerId).toBe('answer-1');
    }
  });

  it('should handle multiple-choice questions', async () => {
    // Add another vote for the same user but different answer in multiple-choice scenario
    const vote3Result = Vote.create(
      'question-1',
      'answer-2',
      'user-1',
      new Decimal(2.0).toNumber()
    );
    expect(vote3Result.success).toBe(true);
    const vote3 = vote3Result.value;
    voteRepository.getVotesByPoll = vi
      .fn()
      .mockResolvedValue(success([vote1, vote2, vote3]));

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      const questionResult = result.value.results[0];
      expect(questionResult.totalVotes).toBe(3);
      const answer1Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-1'
      );
      const answer2Result = questionResult.answers.find(
        (a) => a.answerId === 'answer-2'
      );
      expect(answer1Result?.voteCount).toBe(1);
      expect(answer2Result?.voteCount).toBe(2);
      expect(answer2Result?.totalWeight).toBe(5.0); // 3.0 + 2.0
      // participantWeight = unique voters' weights (each counted once even
      // when they pick multiple answers). user-1 weight 2 + user-2 weight 3 = 5,
      // NOT 7 (= sum across answers, which double-counts user-1).
      expect(questionResult.participantWeight).toBe(5.0);
    }
  });

  it('should include protocolSignWillingness for admin with voted participants', async () => {
    // Set willingToSignProtocol on participants
    participant1.setWillingToSignProtocol(true);
    participant2.setWillingToSignProtocol(false);

    userRepository.findByIds = vi.fn().mockResolvedValue([
      User.reconstitute({
        id: 'user-1',
        firstName: 'Alice',
        lastName: 'Smith',
        middleName: 'M.',
        phoneNumber: PhoneNumber.create('+79001234567'),
        password: 'hashed',
        language: 'ru',
        createdAt: new Date(),
      }),
      User.reconstitute({
        id: 'user-2',
        firstName: 'Bob',
        lastName: 'Johnson',
        phoneNumber: PhoneNumber.create('+79007654321'),
        password: 'hashed',
        language: 'ru',
        createdAt: new Date(),
      }),
    ]);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.protocolSignWillingness).toHaveLength(2);

      const willing = result.value.protocolSignWillingness.find(
        (p) => p.userId === 'user-1'
      );
      expect(willing?.willingToSignProtocol).toBe(true);
      expect(willing?.firstName).toBe('Alice');
      expect(willing?.middleName).toBe('M.');

      const notWilling = result.value.protocolSignWillingness.find(
        (p) => p.userId === 'user-2'
      );
      expect(notWilling?.willingToSignProtocol).toBe(false);
      expect(notWilling?.middleName).toBeNull();

      // Consent is combined — willing means "sign AND share my phone".
      expect(willing?.phoneNumber).toBe('+79001234567');
      // Declining covers both halves, so no phone for the not-willing.
      expect(notWilling?.phoneNumber).toBeNull();
    }
  });

  it('should exclude participants who have not voted from protocolSignWillingness', async () => {
    // Only participant1 has voted (willingToSignProtocol set)
    participant1.setWillingToSignProtocol(true);
    // participant2 has null (not voted yet)

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-admin',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.protocolSignWillingness).toHaveLength(1);
      expect(result.value.protocolSignWillingness[0].userId).toBe('user-1');
    }
  });

  it('should return empty protocolSignWillingness for non-admin', async () => {
    participant1.setWillingToSignProtocol(true);
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-member',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.protocolSignWillingness).toHaveLength(0);
    }
  });

  it('should not expose any phone number to a non-admin', async () => {
    participant1.setWillingToSignProtocol(true);
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
    organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'user-member',
    });

    expect(result.success).toBe(true);

    if (result.success) {
      expect(result.value.protocolSignWillingness).toHaveLength(0);
      // Scan the whole payload, not just protocolSignWillingness — a phone
      // must not reach a non-admin through any other field either.
      expect(JSON.stringify(result.value)).not.toContain('+7900');
    }
  });

  describe('open poll access', () => {
    let openPoll: Poll;

    beforeEach(() => {
      openPoll = Poll.create(
        'Open Poll',
        'Everyone may vote',
        'org-1',
        null,
        'user-1',
        new Date('2026-01-15'),
        new Date('2026-02-15'),
        undefined,
        'OPEN'
      ).value;
      (openPoll as any).props.id = 'poll-1';
      (openPoll as any).props.state = PollState.FINISHED;
      (openPoll as any).props.questions = [question];

      pollRepository.getPollById = vi.fn().mockResolvedValue(success(openPoll));
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
      organizationRepository.isUserMember = vi.fn().mockResolvedValue(false);
    });

    it('lets a non-member who voted read the results', async () => {
      participantRepository.getParticipantByUserAndPoll = vi
        .fn()
        .mockResolvedValue(success(participant1));

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'outsider-1',
      });

      expect(result.success).toBe(true);
    });

    it('rejects a non-member who did not vote', async () => {
      participantRepository.getParticipantByUserAndPoll = vi
        .fn()
        .mockResolvedValue(success(null));

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'outsider-2',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_NOT_ORG_MEMBER);
    });

    it('still lets org members read the results', async () => {
      organizationRepository.isUserMember = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'member-1',
      });

      expect(result.success).toBe(true);
    });

    it('does not open an ACTIVE anonymous poll to a voter who is not an admin', async () => {
      (openPoll as any).props.state = PollState.ACTIVE;
      (openPoll as any).props.anonymous = true;
      participantRepository.getParticipantByUserAndPoll = vi
        .fn()
        .mockResolvedValue(success(participant1));

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'outsider-1',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
    });

    it('opens an ACTIVE named poll to a voter who took part in it', async () => {
      (openPoll as any).props.state = PollState.ACTIVE;
      participantRepository.getParticipantByUserAndPoll = vi
        .fn()
        .mockResolvedValue(success(participant1));

      const result = await useCase.execute({
        pollId: 'poll-1',
        userId: 'outsider-1',
      });

      expect(result.success).toBe(true);

      if (result.success) {
        expect(result.value.canViewVoterNames).toBe(true);
      }
    });
  });
});
