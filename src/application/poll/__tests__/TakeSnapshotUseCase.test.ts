import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TakeSnapshotUseCase } from '../TakeSnapshotUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { Question } from '../../../domain/poll/Question';
import { Answer } from '../../../domain/poll/Answer';
import { Organization } from '../../../domain/organization/Organization';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { Board } from '../../../domain/board/Board';
import { BoardRepository } from '../../../domain/board/BoardRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { PropertyAssetRepository } from '../../../domain/organization/PropertyAssetRepository';
import { PollEligibleMemberRepository } from '../../../domain/poll/PollEligibleMemberRepository';
import { success } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollWeightCalculator } from '../PollWeightCalculator';

describe('TakeSnapshotUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let boardRepository: Partial<BoardRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let userRepository: Partial<UserRepository>;
  let propertyAssetRepository: Partial<PropertyAssetRepository>;
  let eligibleMemberRepository: Partial<PollEligibleMemberRepository>;
  let pollWeightCalculator: Partial<PollWeightCalculator>;
  let useCase: TakeSnapshotUseCase;
  let poll: Poll;

  beforeEach(() => {
    // Create a poll in DRAFT state with question + answer
    const pollResult = Poll.create(
      'Test Poll',
      'Test Description',
      'org-1',
      'board-1',
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    poll = pollResult.value;
    (poll as any).props.id = 'poll-1';

    const questionResult = Question.create(
      'Question 1',
      poll.id,
      1,
      1,
      'single-choice'
    );
    const question = questionResult.value;
    (question as any).props.id = 'question-1';
    const answerResult = Answer.create('Answer 1', 1, question.id);
    question.addAnswer(answerResult.value);
    poll.addQuestion(question);

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
      updatePoll: vi.fn().mockResolvedValue(success(undefined)),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      getDescendantIds: vi.fn().mockResolvedValue([]),
      findById: vi.fn().mockResolvedValue(
        Organization.reconstitute({
          id: 'org-1',
          name: 'Test Org',
          description: 'desc',
          parentId: null,
          createdById: 'admin-1',
          createdAt: new Date(),
          archivedAt: null,
          allowMultiTreeMembership: false,
        })
      ),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    boardRepository = {
      findBoardMembers: vi
        .fn()
        .mockResolvedValue([{ userId: 'user-1' }, { userId: 'user-2' }]),
      findById: vi.fn().mockResolvedValue(
        Board.reconstitute({
          id: 'board-1',
          name: 'Test Board',
          organizationId: 'org-1',
          createdAt: new Date(),
          archivedAt: null,
        })
      ),
    };

    participantRepository = {
      executeActivation: vi.fn().mockResolvedValue(success([])),
    };

    propertyAssetRepository = {
      findCurrentOwnership: vi.fn().mockResolvedValue(success([])),
      findAssetsInScope: vi.fn().mockResolvedValue(success([])),
      orgHasOwnershipData: vi.fn().mockResolvedValue(success(false)),
      hasUserOwnership: vi.fn().mockResolvedValue(success(false)),
    };

    eligibleMemberRepository = {
      createMany: vi.fn().mockResolvedValue(success(undefined)),
      findByPollId: vi.fn().mockResolvedValue(success([])),
    };

    pollWeightCalculator = {
      compute: vi.fn().mockResolvedValue(success(new Map())),
    };

    useCase = new TakeSnapshotUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      boardRepository as BoardRepository,
      organizationRepository as OrganizationRepository,
      userRepository as UserRepository,
      eligibleMemberRepository as PollEligibleMemberRepository,
      pollWeightCalculator as PollWeightCalculator
    );
  });

  it('should fail if organization is archived', async () => {
    organizationRepository.findById = vi.fn().mockResolvedValue(
      Organization.reconstitute({
        id: 'org-1',
        name: 'Archived Org',
        description: 'desc',
        parentId: null,
        createdById: 'admin-1',
        createdAt: new Date(),
        archivedAt: new Date(),
        allowMultiTreeMembership: false,
      })
    );

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.ORGANIZATION_ARCHIVED);
  });

  it('should succeed when organization is not archived', async () => {
    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);
  });

  it('should fail if poll not found', async () => {
    pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

    const result = await useCase.execute({
      pollId: 'non-existent',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_FOUND);
  });

  it('should fail if user is not authorized', async () => {
    organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'regular-user',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
  });

  it('should fail if board is archived', async () => {
    boardRepository.findById = vi.fn().mockResolvedValue(
      Board.reconstitute({
        id: 'board-1',
        name: 'Archived Board',
        organizationId: 'org-1',
        createdAt: new Date(),
        archivedAt: new Date(),
      })
    );

    const result = await useCase.execute({
      pollId: 'poll-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe(PollErrors.BOARD_ARCHIVED);
  });

  // ── Distribution type scenarios ────────────────────────────────────────────

  it('EQUAL with no property scope: all org members become participants with weight 1, eligible members populated for all', async () => {
    // Org-wide poll (boardId=null), EQUAL distribution, no propertyIds
    const orgPollResult = Poll.create(
      'Org Poll',
      'desc',
      'org-1',
      null, // org-wide
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    const orgPoll = orgPollResult.value;
    (orgPoll as any).props.id = 'poll-org-1';
    // distributionType defaults to 'EQUAL', propertyIds defaults to []
    const q = Question.create('Q', orgPoll.id, 1, 1, 'single-choice').value;
    (q as any).props.id = 'q-org-1';
    q.addAnswer(Answer.create('A', 1, q.id).value);
    orgPoll.addQuestion(q);

    pollRepository.getPollById = vi.fn().mockResolvedValue(success(orgPoll));

    organizationRepository.findAcceptedMemberUserIdsIncludingDescendants = vi
      .fn()
      .mockResolvedValue(['user-1', 'user-2', 'user-3']);

    pollWeightCalculator.compute = vi.fn().mockResolvedValue(
      success(
        new Map([
          ['user-1', 1],
          ['user-2', 1],
          ['user-3', 1],
        ])
      )
    );

    const result = await useCase.execute({
      pollId: 'poll-org-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // eligible members saved for all 3 candidates
    const eligibleCall = (
      eligibleMemberRepository.createMany as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(eligibleCall).toHaveLength(3);
    expect(eligibleCall.map((m: any) => m.userId)).toEqual(
      expect.arrayContaining(['user-1', 'user-2', 'user-3'])
    );

    // participants created with weight 1 for all 3
    const activationCall = (
      participantRepository.executeActivation as ReturnType<typeof vi.fn>
    ).mock.calls[0];
    const participants = activationCall[1];
    expect(participants).toHaveLength(3);
    expect(participants.every((p: any) => p.userWeight === 1)).toBe(true);
  });

  it('OWNERSHIP_UNIT_COUNT with no scope: only members with positive ownership become participants; all are in eligible members', async () => {
    const orgPollResult = Poll.create(
      'Ownership Poll',
      'desc',
      'org-1',
      null,
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    const orgPoll = orgPollResult.value;
    (orgPoll as any).props.id = 'poll-own-1';
    orgPoll.applyWeightConfig('OWNERSHIP_UNIT_COUNT', 'RAW_SUM', []);
    const q = Question.create('Q', orgPoll.id, 1, 1, 'single-choice').value;
    (q as any).props.id = 'q-own-1';
    q.addAnswer(Answer.create('A', 1, q.id).value);
    orgPoll.addQuestion(q);

    pollRepository.getPollById = vi.fn().mockResolvedValue(success(orgPoll));

    organizationRepository.findAcceptedMemberUserIdsIncludingDescendants = vi
      .fn()
      .mockResolvedValue(['user-1', 'user-2', 'user-3']);

    // PollWeightCalculator owns the actual ownership-data fetch + math; here
    // we mock its output. user-3 absent from the map → no participant created.
    pollWeightCalculator.compute = vi.fn().mockResolvedValue(
      success(
        new Map([
          ['user-1', 1],
          ['user-2', 0.5],
        ])
      )
    );

    const result = await useCase.execute({
      pollId: 'poll-own-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // eligible members = all 3 candidates
    const eligibleCall = (
      eligibleMemberRepository.createMany as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(eligibleCall).toHaveLength(3);

    // participants = only user-1 and user-2 (user-3 has no ownership)
    const participants = (
      participantRepository.executeActivation as ReturnType<typeof vi.fn>
    ).mock.calls[0][1];
    const participantUserIds = participants.map((p: any) => p.userId);
    expect(participantUserIds).toHaveLength(2);
    expect(participantUserIds).toContain('user-1');
    expect(participantUserIds).toContain('user-2');
    expect(participantUserIds).not.toContain('user-3');
  });

  // The "each-asset-counted-once" multi-owner + ownerless-asset regression
  // lives in PollWeightCalculator.test.ts now; the snapshot use case just
  // delegates to it.

  it('EQUAL with property scope: only members owning in selected properties become participants', async () => {
    const orgPollResult = Poll.create(
      'Scoped Equal Poll',
      'desc',
      'org-1',
      null,
      'admin-1',
      new Date('2024-01-01'),
      new Date('2024-12-31')
    );
    const orgPoll = orgPollResult.value;
    (orgPoll as any).props.id = 'poll-scope-1';
    orgPoll.applyWeightConfig('EQUAL', 'RAW_SUM', ['prop-2']); // only prop-2 in scope
    const q = Question.create('Q', orgPoll.id, 1, 1, 'single-choice').value;
    (q as any).props.id = 'q-scope-1';
    q.addAnswer(Answer.create('A', 1, q.id).value);
    orgPoll.addQuestion(q);

    pollRepository.getPollById = vi.fn().mockResolvedValue(success(orgPoll));

    organizationRepository.findAcceptedMemberUserIdsIncludingDescendants = vi
      .fn()
      .mockResolvedValue(['user-1', 'user-2', 'user-3']);

    // Calculator returns weight 1 only for user-2 (the eligibility-filter
    // logic for EQUAL+scope lives inside the calculator). The use case here
    // is responsible for forwarding the propIds and turning the weight map
    // into participants.
    pollWeightCalculator.compute = vi
      .fn()
      .mockResolvedValue(success(new Map([['user-2', 1]])));

    const result = await useCase.execute({
      pollId: 'poll-scope-1',
      userId: 'admin-1',
    });

    expect(result.success).toBe(true);

    // eligible members = all 3 candidates
    const eligibleCall = (
      eligibleMemberRepository.createMany as ReturnType<typeof vi.fn>
    ).mock.calls[0][0];
    expect(eligibleCall).toHaveLength(3);

    // participants = only user-2 (owns in prop-2); weight = 1 (EQUAL)
    const participants = (
      participantRepository.executeActivation as ReturnType<typeof vi.fn>
    ).mock.calls[0][1];
    expect(participants).toHaveLength(1);
    expect(participants[0].userId).toBe('user-2');
    expect(participants[0].userWeight).toBe(1);

    // Calculator received the poll's propertyIds verbatim — proves the
    // use case forwards the scope correctly without massaging it.
    expect(pollWeightCalculator.compute).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        propertyIds: ['prop-2'],
        candidates: ['user-1', 'user-2', 'user-3'],
      })
    );
  });
});
