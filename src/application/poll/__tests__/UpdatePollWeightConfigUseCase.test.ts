import { describe, it, expect, beforeEach, vi } from 'vitest';
import { UpdatePollWeightConfigUseCase } from '../UpdatePollWeightConfigUseCase';
import { Poll } from '../../../domain/poll/Poll';
import { PollParticipant } from '../../../domain/poll/PollParticipant';
import { PollEligibleMember } from '../../../domain/poll/PollEligibleMember';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PollRepository } from '../../../domain/poll/PollRepository';
import { ParticipantRepository } from '../../../domain/poll/ParticipantRepository';
import { UserRepository } from '../../../domain/user/UserRepository';
import { OrganizationRepository } from '../../../domain/organization/OrganizationRepository';
import { PollEligibleMemberRepository } from '../../../domain/poll/PollEligibleMemberRepository';
import { PropertyAssetRepository } from '../../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../../domain/organization/OrganizationPropertyRepository';
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
  const p = r.value!;
  (p as any).props.id = `participant-${userId}`;

  return p;
}

function makeEligibleMember(userId: string): PollEligibleMember {
  return PollEligibleMember.create('poll-1', userId, new Date());
}

function makeOrgProperty(id: string): OrganizationProperty {
  const r = OrganizationProperty.create(
    'org-1',
    `Property ${id}`,
    null,
    'SQUARE_METERS'
  );
  expect(r.success).toBe(true);
  const prop = r.value!;
  (prop as any).props.id = id;

  return prop;
}

describe('UpdatePollWeightConfigUseCase', () => {
  let pollRepository: Partial<PollRepository>;
  let participantRepository: Partial<ParticipantRepository>;
  let userRepository: Partial<UserRepository>;
  let organizationRepository: Partial<OrganizationRepository>;
  let eligibleRepository: Partial<PollEligibleMemberRepository>;
  let propertyAssetRepository: Partial<PropertyAssetRepository>;
  let organizationPropertyRepository: Partial<OrganizationPropertyRepository>;
  let pollWeightCalculator: Partial<PollWeightCalculator>;
  let useCase: UpdatePollWeightConfigUseCase;
  let poll: Poll;

  beforeEach(() => {
    poll = makePoll();

    pollRepository = {
      getPollById: vi.fn().mockResolvedValue(success(poll)),
    };

    participantRepository = {
      pollHasVotes: vi.fn().mockResolvedValue(success(false)),
      getParticipants: vi.fn().mockResolvedValue(success([])),
      applyWeightConfigChange: vi.fn().mockResolvedValue(success(undefined)),
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

    organizationPropertyRepository = {
      findByOrganization: vi.fn().mockResolvedValue(success([])),
      findByOrganizationTree: vi
        .fn()
        .mockResolvedValue(
          success([{ orgId: 'org-1', orgName: 'Test Org', properties: [] }])
        ),
    };

    pollWeightCalculator = {
      compute: vi.fn().mockResolvedValue(success(new Map())),
    };

    useCase = new UpdatePollWeightConfigUseCase(
      pollRepository as PollRepository,
      participantRepository as ParticipantRepository,
      userRepository as UserRepository,
      organizationRepository as OrganizationRepository,
      eligibleRepository as PollEligibleMemberRepository,
      propertyAssetRepository as PropertyAssetRepository,
      organizationPropertyRepository as OrganizationPropertyRepository,
      pollWeightCalculator as PollWeightCalculator
    );
  });

  describe('happy path — EQUAL → OWNERSHIP_UNIT_COUNT switch', () => {
    it('calls applyWeightConfigChange with correct add/remove/update arrays', async () => {
      // Setup: user-1 has ownership data, user-2 does not
      // Current participants: user-1 with EQUAL weight=1
      const existingParticipant = makeParticipant('user-1', 1);

      eligibleRepository.findByPollId = vi
        .fn()
        .mockResolvedValue(
          success([makeEligibleMember('user-1'), makeEligibleMember('user-2')])
        );

      participantRepository.getParticipants = vi
        .fn()
        .mockResolvedValue(success([existingParticipant]));

      // user-1: weight 1 from owning asset-a; user-2: no ownership.
      pollWeightCalculator.compute = vi
        .fn()
        .mockResolvedValue(success(new Map([['user-1', 1.0]])));

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
        adminUserId: 'admin-user',
      });

      expect(result.success).toBe(true);

      const applyCall = (
        participantRepository.applyWeightConfigChange as ReturnType<
          typeof vi.fn
        >
      ).mock.calls[0];
      const [
        pollId,
        newDT,
        newPA,
        newPropIds,
        add,
        remove,
        update,
        adminUserId,
        reason,
      ] = applyCall;

      expect(pollId).toBe('poll-1');
      expect(newDT).toBe('OWNERSHIP_UNIT_COUNT');
      expect(newPA).toBe('RAW_SUM');
      expect(newPropIds).toEqual([]);
      expect(adminUserId).toBe('admin-user');
      expect(reason).toBe('Distribution type changed to OWNERSHIP_UNIT_COUNT');

      // user-1: existing participant, new weight = share*1 = 1.0 — weight unchanged, so NOT in update
      expect(update).toHaveLength(0);
      // user-2: no ownership data → no weight → not added
      expect(add).toHaveLength(0);
      // user-1 stays, nothing removed
      expect(remove).toHaveLength(0);
    });
  });

  // The "each asset counted once" multi-owner + ownerless-asset regression
  // is owned by PollWeightCalculator.test.ts; this use case only adapts the
  // weight map to add/remove/update arrays.

  describe('votes-cast guard', () => {
    it('rejects with VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG when poll has votes', async () => {
      participantRepository.pollHasVotes = vi
        .fn()
        .mockResolvedValue(success(true));

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: {},
        adminUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(
        PollDomainCodes.VOTES_CAST_CANNOT_CHANGE_WEIGHT_CONFIG
      );
      expect(
        participantRepository.applyWeightConfigChange
      ).not.toHaveBeenCalled();
    });
  });

  describe('state guard — only DRAFT/READY allow weight-config edits', () => {
    // Bypass takeSnapshot()/activate() validation (test poll has no questions)
    // and set the state directly — we only care about the guard, not the
    // transitions themselves.
    function setState(state: 'ACTIVE' | 'FINISHED' | 'READY') {
      (poll as any).props.state = state;
    }

    it('rejects with WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION when poll is ACTIVE', async () => {
      setState('ACTIVE');

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
        adminUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(
        PollDomainCodes.WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION
      );
      expect(
        participantRepository.applyWeightConfigChange
      ).not.toHaveBeenCalled();
    });

    it('rejects with WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION when poll is FINISHED', async () => {
      setState('FINISHED');

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
        adminUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(
        PollDomainCodes.WEIGHT_CONFIG_LOCKED_AFTER_ACTIVATION
      );
    });

    it('allows edits in READY (post-snapshot, pre-activation)', async () => {
      setState('READY');

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { distributionType: 'OWNERSHIP_UNIT_COUNT' },
        adminUserId: 'admin-user',
      });

      expect(result.success).toBe(true);
    });
  });

  describe('property validation', () => {
    it('rejects with PROPERTY_NOT_IN_ORG when propertyIds contains an id not in org', async () => {
      organizationPropertyRepository.findByOrganizationTree = vi
        .fn()
        .mockResolvedValue(
          success([
            {
              orgId: 'org-1',
              orgName: 'Test Org',
              properties: [makeOrgProperty('prop-valid')],
            },
          ])
        );

      const result = await useCase.execute({
        pollId: 'poll-1',
        newConfig: { propertyIds: ['prop-valid', 'prop-unknown'] },
        adminUserId: 'admin-user',
      });

      expect(result.success).toBe(false);

      if (result.success) {
        return;
      }

      expect(result.error).toBe(PollDomainCodes.PROPERTY_NOT_IN_ORG);
      expect(
        participantRepository.applyWeightConfigChange
      ).not.toHaveBeenCalled();
    });
  });
});
