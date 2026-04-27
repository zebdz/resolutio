import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PreviewPollWeightConfigUseCase } from '../PreviewPollWeightConfigUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollEligibleMember } from '../../../domain/poll/PollEligibleMember';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { PollEligibleMemberRepository } from '../../../domain/poll/PollEligibleMemberRepository';
import { PropertyAssetRepository } from '../../../domain/organization/PropertyAssetRepository';
import { success, failure } from '../../../domain/shared/Result';
import { PollErrors } from '../PollErrors';
import { PollDomainCodes } from '../../../domain/poll/PollDomainCodes';
import { PollWeightCalculator } from '../PollWeightCalculator';

function makePoll(): Poll {
  const r = Poll.create(
    'Test Poll',
    'Test Description',
    'org-1',
    'board-1',
    'admin-user',
    new Date('2026-01-01'),
    new Date('2026-12-31')
  );
  expect(r.success).toBe(true);
  const poll = r.value!;
  (poll as any).props.id = 'poll-1';

  return poll;
}

function makeParticipant(userId: string, weight: number): PollParticipant {
  const r = PollParticipant.create('poll-1', userId, weight);
  expect(r.success).toBe(true);

  return r.value!;
}

function makeEligibleMember(userId: string): PollEligibleMember {
  return PollEligibleMember.create('poll-1', userId, new Date());
}

describe('PreviewPollWeightConfigUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let userRepository: Partial<UserRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let eligibleRepository: Partial<PollEligibleMemberRepository>;
  let propertyAssetRepository: Partial<PropertyAssetRepository>;
  let pollWeightCalculator: Partial<PollWeightCalculator>;
  let useCase: PreviewPollWeightConfigUseCase;
  let poll: Poll;

  beforeEach(() => {
    poll = makePoll();

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
      getParticipants: vi.fn().mockResolvedValue(success([])),
    };

    userRepository = {
      isSuperAdmin: vi.fn().mockResolvedValue(false),
    };

    organizationRepository = {
      isUserAdmin: vi.fn().mockResolvedValue(true),
      getDescendantIds: vi.fn().mockResolvedValue([]),
    };

    eligibleRepository = {
      findByPollId: vi
        .fn()
        .mockResolvedValue(success([makeEligibleMember('user-1')])),
    };

    propertyAssetRepository = {
      orgHasOwnershipData: vi.fn().mockResolvedValue(success(true)),
      findCurrentOwnership: vi.fn().mockResolvedValue(success([])),
      findAssetsInScope: vi.fn().mockResolvedValue(success([])),
    };

    pollWeightCalculator = {
      // Default: user-1 gets weight 1 — matches the "happy path EQUAL"
      // expectations. Tests that need different weights override per-test.
      compute: vi.fn().mockResolvedValue(success(new Map([['user-1', 1]]))),
    };

    useCase = new PreviewPollWeightConfigUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      userRepository as UserRepository,
      organizationRepository as OrganizationRepository,
      eligibleRepository as PollEligibleMemberRepository,
      propertyAssetRepository as PropertyAssetRepository,
      pollWeightCalculator as PollWeightCalculator
    );
  });

  describe('happy path — EQUAL distribution', () => {
    it('returns added participant when not yet a current participant', async () => {
      // user-1 is eligible but not yet a current participant → should appear in addedParticipants
      participantRepository.getParticipants = vi
        .fn()
        .mockResolvedValue(success([]));

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'EQUAL' },
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value.addedParticipants).toHaveLength(1);
      expect(result.value.addedParticipants[0].userId).toBe('user-1');
      expect(result.value.addedParticipants[0].newWeight).toBe(1);
      expect(result.value.removedParticipants).toHaveLength(0);
      expect(result.value.reweightedParticipants).toHaveLength(0);
      expect(result.value.totalWeight).toBe(1);
    });

    it('detects no diff when existing participant already has weight 1', async () => {
      participantRepository.getParticipants = vi
        .fn()
        .mockResolvedValue(success([makeParticipant('user-1', 1)]));

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'EQUAL' },
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(true);

      if (!result.success) {
        return;
      }

      expect(result.value.addedParticipants).toHaveLength(0);
      expect(result.value.removedParticipants).toHaveLength(0);
      expect(result.value.reweightedParticipants).toHaveLength(0);
    });
  });

  describe('state guard — only DRAFT/READY allow weight-config preview', () => {
    function setState(state: 'ACTIVE' | 'FINISHED') {
      (poll as any).props.state = state;
    }

    it('rejects with WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION when poll is ACTIVE', async () => {
      setState('ACTIVE');

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(
        PollDomainCodes.WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION
      );
    });

    it('rejects with WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION when poll is FINISHED', async () => {
      setState('FINISHED');

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(
        PollDomainCodes.WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION
      );
    });
  });

  describe('votes-cast guard', () => {
    it('rejects with VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG when poll has votes', async () => {
      participantRepository.pollHasVotes = vi
        .fn()
        .mockResolvedValue(success(true));

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: {},
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(
        PollDomainCodes.VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG
      );
    });
  });

  describe('ownership mode guard', () => {
    it('rejects with OWNERSHIP_DATA_MISSING when org has no ownership data', async () => {
      propertyAssetRepository.orgHasOwnershipData = vi
        .fn()
        .mockResolvedValue(success(false));

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(PollDomainCodes.OWNERSHIP_DATA_MISSING);
    });
  });

  describe('authorization', () => {
    it('rejects non-admin non-superadmin', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(false);

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: {},
        actingUserId: 'regular-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(PollErrors.NOT_AUTHORIZED);
    });

    it('allows superadmin even when not org admin', async () => {
      organizationRepository.isUserAdmin = vi.fn().mockResolvedValue(false);
      userRepository.isSuperAdmin = vi.fn().mockResolvedValue(true);

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'EQUAL' },
        actingUserId: 'superadmin-1',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('poll not found', () => {
    it('returns NOT_FOUND when poll does not exist', async () => {
      pollRepository.getPollById = vi.fn().mockResolvedValue(success(null));

      const result = await useCase.execute({
        pollId: 'no-such-poll',
        newConfig: {},
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(PollErrors.NOT_FOUND);
    });
  });

  describe('invalid config values', () => {
    it('rejects invalid distributionType', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'BOGUS_TYPE' },
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(PollDomainCodes.DISTRIBUTION_TYPE_INVALID);
    });

    it('rejects invalid propertyAggregation', async () => {
      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { propertyAggregation: 'BOGUS_AGG' },
        actingUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(PollDomainCodes.PROPERTY_AGGREGATION_INVALID);
    });
  });
});
