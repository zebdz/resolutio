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
    const p = PollParticipant.create('poll-1', userId, weight).value;
    (p as any).props.id = `participant-${userId}`;
    (p as any).props.snapshotAt = snapshotAt;

    return p;
  }

  beforeEach(() => {
    poll = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      null,
      'user-admin',
      new Date('2026-01-15'),
      new Date('2026-02-15')
    ).value;
    (poll as any).props.id = 'poll-1';
    (poll as any).props.state = PollState.FINISHED;

    const question = Question.create(
      'Q1',
      'poll-1',
      1,
      0,
      'single-choice'
    ).value;
    (question as any).props.id = 'question-1';

    const answer1 = Answer.create('Yes', 1, 'question-1').value;
    (answer1 as any).props.id = 'answer-1';
    const answer2 = Answer.create('No', 2, 'question-1').value;
    (answer2 as any).props.id = 'answer-2';
    (question as any).props.answers = [answer1, answer2];
    (poll as any).props.questions = [question];

    const p1 = makeParticipant('user-1', 2);
    const p2 = makeParticipant('user-2', 3);
    const p3 = makeParticipant('user-3', 1);

    const vote1 = Vote.create('question-1', 'answer-1', 'user-1', 2).value;
    const vote2 = Vote.create('question-1', 'answer-2', 'user-2', 3).value;

    deps = {
      pollRepository: { getPollById: vi.fn().mockResolvedValue(success(poll)) },
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
      (poll as any).props.anonymous = true;

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
      (poll as any).props.state = PollState.READY;

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
            Vote.create('question-1', 'answer-1', 'user-1', 2).value,
            Vote.create('question-1', 'answer-2', 'user-1', 2).value,
            Vote.create('question-1', 'answer-2', 'user-2', 3).value,
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
      (poll as any).props.pollType = 'OPEN';

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      if (!result.success) {
        throw new Error('expected success');
      }

      expect(result.value.questions[0].nonVoterIds).toEqual([]);
    });

    it('skips archived questions', async () => {
      (poll as any).props.questions[0].archive();

      const result = await useCase.execute({ pollId: 'poll-1', userId: 'u' });

      if (!result.success) {
        throw new Error('expected success');
      }

      expect(result.value.questions).toEqual([]);
    });
  });

  describe('holdings', () => {
    function makePropertyBased() {
      (poll as any).props.distributionType = 'OWNERSHIP_SIZE_WEIGHTED';
      (poll as any).props.propertyIds = ['prop-1'];
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
        asOf: SNAPSHOT_AT,
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
      expect(calls[0][0].asOf).toEqual(SNAPSHOT_AT);
      expect(calls[1][0].userIds).toEqual(['user-2']);
      expect(calls[1][0].asOf).toEqual(LATER_SNAPSHOT_AT);
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
