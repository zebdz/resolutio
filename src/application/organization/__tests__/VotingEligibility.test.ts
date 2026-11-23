/** Both directions require a reason before a membership or its audit can change. */
import { it, expect, vi } from 'vitest';
import { VotingEligibility } from '../VotingEligibility';
import { UserId } from '@/domain/shared/EntityIds';

it.each([true, false])(
  'rejects a blank reason when setting eligibility to %s',
  async (eligible) => {
    const store = { change: vi.fn(), history: vi.fn() };
    const service = new VotingEligibility(store);
    expect(
      await service.change(UserId.parse('actor'), {
        organizationId: 'org',
        memberId: 'member',
        eligible,
        reason: '  ',
      })
    ).toEqual({
      success: false,
      error: 'organization.eligibility.invalidReason',
    });
    expect(store.change).not.toHaveBeenCalled();
  }
);
