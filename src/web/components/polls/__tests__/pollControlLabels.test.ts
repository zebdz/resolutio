import { describe, it, expect } from 'vitest';
import { PollState } from '@/domain/poll/PollState';
import {
  getPollControlLabelKeys,
  shouldShowReadyHint,
  shouldShowManageParticipants,
} from '../pollControlLabels';

describe('getPollControlLabelKeys', () => {
  it('gives organization polls the participant-snapshot vocabulary', () => {
    expect(getPollControlLabelKeys(false)).toEqual({
      prepare: 'takeSnapshot',
      preparing: 'takingSnapshot',
      prepared: 'snapshotTaken',
      confirmPrepare: 'confirmTakeSnapshot',
      revert: 'discardSnapshot',
      reverting: 'discardingSnapshot',
      reverted: 'snapshotDiscarded',
      confirmRevert: 'confirmDiscardSnapshot',
    });
  });

  it('gives open polls the ready/draft vocabulary', () => {
    expect(getPollControlLabelKeys(true)).toEqual({
      prepare: 'type.markReady',
      preparing: 'type.markingReady',
      prepared: 'type.markedReady',
      confirmPrepare: 'type.confirmMarkReady',
      revert: 'type.backToDraft',
      reverting: 'type.returningToDraft',
      reverted: 'type.returnedToDraft',
      confirmRevert: 'type.confirmBackToDraft',
    });
  });
});

describe('shouldShowReadyHint', () => {
  it('shows the hint for an open poll waiting in READY', () => {
    expect(shouldShowReadyHint(true, PollState.READY)).toBe(true);
  });

  it('hides the hint in every other open-poll state', () => {
    expect(shouldShowReadyHint(true, PollState.DRAFT)).toBe(false);
    expect(shouldShowReadyHint(true, PollState.ACTIVE)).toBe(false);
    expect(shouldShowReadyHint(true, PollState.FINISHED)).toBe(false);
  });

  it('never shows the hint for an organization poll', () => {
    expect(shouldShowReadyHint(false, PollState.READY)).toBe(false);
  });
});

describe('shouldShowManageParticipants', () => {
  it('always offers the page for organization polls', () => {
    for (const state of [
      PollState.DRAFT,
      PollState.READY,
      PollState.ACTIVE,
      PollState.FINISHED,
    ]) {
      expect(shouldShowManageParticipants(false, state)).toBe(true);
    }
  });

  it('hides the page for an open poll that cannot have voters yet', () => {
    expect(shouldShowManageParticipants(true, PollState.DRAFT)).toBe(false);
    expect(shouldShowManageParticipants(true, PollState.READY)).toBe(false);
  });

  it('offers the page once an open poll can accumulate voters', () => {
    expect(shouldShowManageParticipants(true, PollState.ACTIVE)).toBe(true);
    expect(shouldShowManageParticipants(true, PollState.FINISHED)).toBe(true);
  });
});
