import { PollPeriod } from '@/domain/poll/PollPeriod';
import { PollTitle, PollDescription } from '@/domain/poll/PollContent';
import { QuestionText, AnswerText } from '@/domain/poll/QuestionValues';
import { VotingWeight } from '@/domain/poll/VotingWeight';
import { PageNumber, SortOrder } from '@/domain/poll/QuestionValues';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { UserId } from '@/domain/shared/EntityIds';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { participantFixtureData } from '@/application/poll/__tests__/pollFixtureCreation';
import { Instant } from '@/domain/shared/Instant';
import { pollFixtureCreation } from '@/application/poll/__tests__/pollFixtureCreation';
import { testCreation } from '@/domain/shared/__tests__/creation';
import {
  ParticipantId,
  QuestionId,
  AnswerId,
  VoteId,
  PollId,
} from '@/domain/shared/EntityIds';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GetNamedProtocolUseCase } from '../GetNamedProtocolUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollState } from '../../../domain/poll/PollState';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Vote } from '../../../domain/poll/Vote';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { success, failure } from '../../../domain/shared/Result';

const SNAPSHOT_AT = new Date('2026-02-01T00:00:00Z');
const LATER_SNAPSHOT_AT = new Date('2026-02-05T00:00:00Z');

describe('GetNamedProtocolUseCase', () => {
  let deps: any;
  let poll: Poll;
  let useCase: GetNamedProtocolUseCase;

  function build() {
    return new GetNamedProtocolUseCase(
      deps.pollRepository,
      deps.participantRepository,
      deps.voteRepository,
      deps.organizationRepository,
      deps.userRepository,
      deps.propertyAssetRepository
    );
  }

  function makeParticipant(
    userId: string,
    weight: number,
    snapshotAt: Date = SNAPSHOT_AT
  ) {
    let p = expectSuccess(
      PollParticipant.create(
        PollId.parse('poll-1'),
        UserId.parse(userId),
        pollFixtureCreation(ParticipantId),
        VotingWeight.parse(weight)
      )
    );
    p = PollParticipant.reconstitute({
      ...participantFixtureData(p),
      id: `participant-${userId}`,
    });
    p = PollParticipant.reconstitute({
      ...participantFixtureData(p),
      snapshotAt: snapshotAt,
    });

    return p;
  }

  beforeEach(() => {
    poll = expectSuccess(
      Poll.create(
        PollTitle.parse('Test Poll'),
        PollDescription.parse('Test Description'),
        OrganizationId.parse('org-1'),
        null,
        UserId.parse('user-admin'),
        expectSuccess(
          PollPeriod.create(new Date('2026-01-15'), new Date('2026-02-15'))
        ),
        testCreation(PollId, 'poll-1')
      )
    );
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      id: 'poll-1',
    });
    poll = Poll.reconstitute({
      ...poll.toJSON(),
      questions: poll.questions,
      finishedAt: null,
      state: PollState.FINISHED,
    });

    let question = expectSuccess(
      Question.create(
        QuestionText.parse('Q1'),
        PollId.parse('poll-1'),
        pollFixtureCreation(QuestionId),
        PageNumber.parse(1),
        SortOrder.parse(0),
        'single-choice'
      )
    );
    question = Question.reconstitute({
      ...question.toJSON(),
      answers: question.answers,
      id: 'question-1',
    });

    let answer1 = expectSuccess(
      Answer.create(
        AnswerText.parse('Yes'),
        SortOrder.parse(1),
        QuestionId.parse('question-1'),
        pollFixtureCreation(AnswerId)
      )
    );
    answer1 = Answer.reconstitute({ ...answer1.toJSON(), id: 'answer-1' });
    let answer2 = expectSuccess(
      Answer.create(
        AnswerText.parse('No'),
        SortOrder.parse(2),
        QuestionId.parse('question-1'),
        pollFixtureCreation(AnswerId)
      )
    );
    answer2 = Answer.reconstitute({ ...answer2.toJSON(), id: 'answer-2' });

    for (const answer of [answer1, answer2]) {
      question.addAnswer(answer);
    }

    poll = Poll.reconstitute({ ...poll.toJSON(), questions: [question] });

    const p1 = makeParticipant('user-1', 2);
    const p2 = makeParticipant('user-2', 3);
    const p3 = makeParticipant('user-3', 1);

    const vote1 = expectSuccess(
      Vote.create(
        QuestionId.parse('question-1'),
        AnswerId.parse('answer-1'),
        UserId.parse('user-1'),
        VotingWeight.parse(2),
        pollFixtureCreation(VoteId, new Date())
      )
    );
    const vote2 = expectSuccess(
      Vote.create(
        QuestionId.parse('question-1'),
        AnswerId.parse('answer-2'),
        UserId.parse('user-2'),
        VotingWeight.parse(3),
        pollFixtureCreation(VoteId, new Date())
      )
    );

    deps = {
      pollRepository: {
        getPollById: vi.fn().mockImplementation(async () => success(poll)),
      },
      participantRepository: {
        getParticipants: vi.fn().mockResolvedValue(success([p1, p2, p3])),
        getParticipantByUserAndPoll: vi.fn().mockResolvedValue(success(null)),
      },
      voteRepository: {
        getVotesByPoll: vi.fn().mockResolvedValue(success([vote1, vote2])),
      },
      organizationRepository: {
        isUserAdmin: vi.fn().mockResolvedValue(true),
        isUserMember: vi.fn().mockResolvedValue(true),
        getDescendantIds: vi.fn().mockResolvedValue([]),
      },
      userRepository: {
        isSuperAdmin: vi.fn().mockResolvedValue(false),
        findByIds: vi.fn().mockResolvedValue([
          {
            id: 'user-1',
            firstName: 'Иван',
            lastName: 'Иванов',
            middleName: 'Иванович',
          },
          {
            id: 'user-2',
            firstName: 'Пётр',
            lastName: 'Петров',
            middleName: null,
          },
          {
            id: 'user-3',
            firstName: 'Сергей',
            lastName: 'Волков',
            middleName: null,
          },
        ]),
      },
      propertyAssetRepository: {
        findHoldingsAsOf: vi.fn().mockResolvedValue(success([])),
      },
    };

    useCase = build();
  });

  describe('authorization', () => {
    it('refuses on an anonymous poll', async () => {
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        anonymous: true,
      });

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.POLL_IS_ANONYMOUS);
      }
    });

    it('refuses an outsider on a named poll', async () => {
      deps.organizationRepository.isUserAdmin = vi
        .fn()
        .mockResolvedValue(false);
      deps.organizationRepository.isUserMember = vi
        .fn()
        .mockResolvedValue(false);
      useCase = build();

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.POLL_RESULTS_ADMIN_ONLY);
      }
    });

    it('refuses on a READY poll — nothing has been voted yet', async () => {
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        finishedAt: null,
        state: PollState.READY,
      });

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe(PollDomainCodes.POLL_PROTOCOL_NOT_AVAILABLE);
      }
    });

    it('lets a plain org member through on a named poll', async () => {
      deps.organizationRepository.isUserAdmin = vi
        .fn()
        .mockResolvedValue(false);
      useCase = build();

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(result.success).toBe(true);
    });
  });

  describe('register', () => {
    it('lists every participant sorted by name', async () => {
      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value.register.map((p) => p.userId)).toEqual([
        'user-3', // Волков
        'user-1', // Иванов
        'user-2', // Петров
      ]);
      expect(
        result.value.register.find((p) => p.userId === 'user-1')!.weight
      ).toBe(2);
      expect(result.value.totalParticipants).toBe(3);
      expect(result.value.totalParticipantWeight).toBe(6);
    });

    it('includes non-voters, so the did-not-vote list can reference it', async () => {
      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      if (!result.success) {
        throw new Error('expected success');
      }

      expect(result.value.register.some((p) => p.userId === 'user-3')).toBe(
        true
      );
    });
  });

  describe('tally', () => {
    it('lists per-answer voters and the non-voters for the question', async () => {
      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      if (!result.success) {
        throw new Error('expected success');
      }

      const q = result.value.questions[0];

      expect(q.answers[0].voters).toEqual([{ userId: 'user-1', weight: 2 }]);
      expect(q.answers[1].voters).toEqual([{ userId: 'user-2', weight: 3 }]);
      expect(q.nonVoterIds).toEqual(['user-3']);
      expect(q.participantWeight).toBe(5);
      expect(q.answers[0].percentage).toBeCloseTo((2 / 6) * 100);
    });

    it('counts a multi-choice voter once in participantWeight', async () => {
      deps.voteRepository.getVotesByPoll = vi
        .fn()
        .mockResolvedValue(
          success([
            expectSuccess(
              Vote.create(
                QuestionId.parse('question-1'),
                AnswerId.parse('answer-1'),
                UserId.parse('user-1'),
                VotingWeight.parse(2),
                pollFixtureCreation(VoteId, new Date())
              )
            ),
            expectSuccess(
              Vote.create(
                QuestionId.parse('question-1'),
                AnswerId.parse('answer-2'),
                UserId.parse('user-1'),
                VotingWeight.parse(2),
                pollFixtureCreation(VoteId, new Date())
              )
            ),
            expectSuccess(
              Vote.create(
                QuestionId.parse('question-1'),
                AnswerId.parse('answer-2'),
                UserId.parse('user-2'),
                VotingWeight.parse(3),
                pollFixtureCreation(VoteId, new Date())
              )
            ),
          ])
        );
      useCase = build();

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      if (!result.success) {
        throw new Error('expected success');
      }

      const q = result.value.questions[0];

      expect(q.participantWeight).toBe(5);
      expect(q.totalVotes).toBe(3);
      expect(q.nonVoterIds).toEqual(['user-3']);
    });

    it('leaves nonVoterIds empty for an open poll', async () => {
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        boardId: null,
        distributionType: 'EQUAL',
        propertyIds: [],
        pollType: 'OPEN',
      });

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      if (!result.success) {
        throw new Error('expected success');
      }

      expect(result.value.questions[0].nonVoterIds).toEqual([]);
    });

    it('skips archived questions', async () => {
      poll.questions[0].archive(Instant.parse('2026-01-02T00:00:00.000Z'));

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      if (!result.success) {
        throw new Error('expected success');
      }

      expect(result.value.questions).toEqual([]);
    });
  });

  describe('holdings', () => {
    function makePropertyBased() {
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        distributionType: 'OWNERSHIP_SIZE_WEIGHTED',
      });
      poll = Poll.reconstitute({
        ...poll.toJSON(),
        questions: poll.questions,
        propertyIds: ['prop-1'],
      });
    }

    it('skips the holdings query entirely for an EQUAL poll', async () => {
      await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(
        deps.propertyAssetRepository.findHoldingsAsOf
      ).not.toHaveBeenCalled();
    });

    it('reads holdings at the snapshot, in the poll property scope', async () => {
      makePropertyBased();
      deps.organizationRepository.getDescendantIds = vi
        .fn()
        .mockResolvedValue(['org-child']);
      deps.propertyAssetRepository.findHoldingsAsOf = vi.fn().mockResolvedValue(
        success([
          {
            userId: 'user-1',
            propertyName: 'Дом Гвардейский 13',
            assetName: 'кв. 738',
            size: 64,
            sizeUnit: 'SQUARE_METERS',
            share: 1,
          },
        ])
      );
      useCase = build();

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(
        deps.propertyAssetRepository.findHoldingsAsOf
      ).toHaveBeenCalledWith({
        organizationIds: ['org-1', 'org-child'],
        propertyIds: ['prop-1'],
        userIds: ['user-1', 'user-2', 'user-3'],
        asOf: Instant.fromDate(SNAPSHOT_AT),
      });

      if (!result.success) {
        throw new Error('expected success');
      }

      expect(
        result.value.register.find((p) => p.userId === 'user-1')!.holdings
      ).toEqual([
        {
          propertyName: 'Дом Гвардейский 13',
          assetName: 'кв. 738',
          size: 64,
          sizeUnitKey: 'propertyAdmin.sizeUnit.squareMeters',
          share: 1,
        },
      ]);
      expect(
        result.value.register.find((p) => p.userId === 'user-2')!.holdings
      ).toEqual([]);
    });

    it('queries once per distinct snapshot instant', async () => {
      makePropertyBased();
      deps.participantRepository.getParticipants = vi
        .fn()
        .mockResolvedValue(
          success([
            makeParticipant('user-1', 2),
            makeParticipant('user-2', 3, LATER_SNAPSHOT_AT),
          ])
        );
      useCase = build();

      await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      const calls = deps.propertyAssetRepository.findHoldingsAsOf.mock.calls;

      expect(calls).toHaveLength(2);
      expect(calls[0][0].userIds).toEqual(['user-1']);
      expect(calls[0][0].asOf).toEqual(Instant.fromDate(SNAPSHOT_AT));
      expect(calls[1][0].userIds).toEqual(['user-2']);
      expect(calls[1][0].asOf).toEqual(Instant.fromDate(LATER_SNAPSHOT_AT));
    });

    it('propagates a holdings read failure instead of silently emptying it', async () => {
      makePropertyBased();
      deps.propertyAssetRepository.findHoldingsAsOf = vi
        .fn()
        .mockResolvedValue(failure('connection lost'));
      useCase = build();

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      expect(result.success).toBe(false);

      if (!result.success) {
        expect(result.error).toBe('connection lost');
      }
    });
  });
});
