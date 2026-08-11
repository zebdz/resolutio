import { describe, it, expect } from 'vitest';
import { PollState } from '@/domain/poll/PollState';
import {
  canSeeResultsBeforePollEnds,
  canViewPollPage,
  getPollControlLabelKeys,
  getPollLifecycleActions,
  getPollOpenMode,
  getReturnToDraftLabelKeys,
  shouldShowReadyHint,
  shouldShowManageParticipants,
} from '../pollControlLabels';

const ALL_STATES = [
  PollState.DRAFT,
  PollState.SUBMITTED,
  PollState.READY,
  PollState.ACTIVE,
  PollState.FINISHED,
];

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
      revert: 'type.backToReview',
      reverting: 'type.returningToReview',
      reverted: 'type.returnedToReview',
      confirmRevert: 'type.confirmBackToReview',
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

describe('getPollOpenMode', () => {
  it('lets the author edit until the poll is active', () => {
    for (const state of [PollState.DRAFT, PollState.READY]) {
      expect(
        getPollOpenMode({
          isCreator: true,
          canManage: false,
          state,
          isParentArchived: false,
        })
      ).toBe('edit');
    }
  });

  it('drops the author to reading once editing is closed server-side', () => {
    for (const state of [PollState.ACTIVE, PollState.FINISHED]) {
      expect(
        getPollOpenMode({
          isCreator: true,
          canManage: true,
          state,
          isParentArchived: false,
        })
      ).toBe('read');
    }
  });

  // The regression: the legality check is an admin feature that lives on the
  // poll page, and an admin who did not write the poll had no way to open it.
  it('lets an admin who is not the author read the poll in every state', () => {
    for (const state of ALL_STATES) {
      expect(
        getPollOpenMode({
          isCreator: false,
          canManage: true,
          state,
          isParentArchived: false,
        })
      ).toBe('read');
    }
  });

  it('offers nothing to a member who neither wrote nor administers the poll', () => {
    for (const state of ALL_STATES) {
      expect(
        getPollOpenMode({
          isCreator: false,
          canManage: false,
          state,
          isParentArchived: false,
        })
      ).toBe('none');
    }
  });

  it('withdraws editing under an archived org or board, keeping the read path', () => {
    expect(
      getPollOpenMode({
        isCreator: true,
        canManage: true,
        state: PollState.DRAFT,
        isParentArchived: true,
      })
    ).toBe('read');

    expect(
      getPollOpenMode({
        isCreator: true,
        canManage: false,
        state: PollState.DRAFT,
        isParentArchived: true,
      })
    ).toBe('none');
  });
});

describe('getPollLifecycleActions', () => {
  const author = { isCreator: true, canManage: false };
  const admin = { isCreator: false, canManage: true };
  const bystander = { isCreator: false, canManage: false };

  // The flaw this state exists to fix: an admin could freeze participants or
  // activate a poll while its author was still writing it.
  it('offers an admin nothing at all on a draft', () => {
    const actions = getPollLifecycleActions({
      state: PollState.DRAFT,
      ...admin,
      isParentArchived: false,
    });

    expect(actions.prepare).toBe(false);
    expect(actions.activate).toBe(false);
    expect(Object.values(actions).some(Boolean)).toBe(false);
  });

  it('gives the author the handover, and only them', () => {
    const forAuthor = getPollLifecycleActions({
      state: PollState.DRAFT,
      ...author,
      isParentArchived: false,
    });
    const forAdmin = getPollLifecycleActions({
      state: PollState.DRAFT,
      ...admin,
      isParentArchived: false,
    });

    expect(forAuthor.submit).toBe(true);
    expect(forAdmin.submit).toBe(false);
  });

  it('opens the admin path only once the poll is submitted', () => {
    const actions = getPollLifecycleActions({
      state: PollState.SUBMITTED,
      ...admin,
      isParentArchived: false,
    });

    expect(actions.prepare).toBe(true);
    expect(actions.returnToDraft).toBe(true);
    expect(actions.activate).toBe(false);
  });

  it('lets the author recall a submitted poll but not prepare it', () => {
    const actions = getPollLifecycleActions({
      state: PollState.SUBMITTED,
      ...author,
      isParentArchived: false,
    });

    expect(actions.returnToDraft).toBe(true);
    expect(actions.prepare).toBe(false);
  });

  // The author has to be able to point an admin at the poll directly, rather
  // than relying on them spotting it in a list.
  it('offers the author a review link only while the poll is submitted', () => {
    expect(
      getPollLifecycleActions({
        state: PollState.SUBMITTED,
        ...author,
        isParentArchived: false,
      }).copyReviewLink
    ).toBe(true);

    for (const state of [PollState.DRAFT, PollState.READY, PollState.ACTIVE]) {
      expect(
        getPollLifecycleActions({
          state,
          ...author,
          isParentArchived: false,
        }).copyReviewLink
      ).toBe(false);
    }
  });

  it('does not offer the review link to an admin, who is already there', () => {
    expect(
      getPollLifecycleActions({
        state: PollState.SUBMITTED,
        ...admin,
        isParentArchived: false,
      }).copyReviewLink
    ).toBe(false);
  });

  // Recall closes at READY: from there the way back is discardSnapshot, which
  // has to reckon with votes.
  it('drops the return path once participants are frozen', () => {
    for (const who of [author, admin]) {
      const actions = getPollLifecycleActions({
        state: PollState.READY,
        ...who,
        isParentArchived: false,
      });

      expect(actions.returnToDraft).toBe(false);
      expect(actions.submit).toBe(false);
    }
  });

  it('keeps the admin lifecycle from READY onwards', () => {
    const ready = getPollLifecycleActions({
      state: PollState.READY,
      ...admin,
      isParentArchived: false,
    });
    const active = getPollLifecycleActions({
      state: PollState.ACTIVE,
      ...admin,
      isParentArchived: false,
    });

    expect(ready.activate).toBe(true);
    expect(ready.revert).toBe(true);
    expect(active.deactivate).toBe(true);
    expect(active.finish).toBe(true);
  });

  it('offers a plain member nothing in any state', () => {
    for (const state of [
      PollState.DRAFT,
      PollState.SUBMITTED,
      PollState.READY,
      PollState.ACTIVE,
      PollState.FINISHED,
    ]) {
      const actions = getPollLifecycleActions({
        state,
        ...bystander,
        isParentArchived: false,
      });

      expect(Object.values(actions).some(Boolean)).toBe(false);
    }
  });

  it('withdraws every transition under an archived org or board', () => {
    for (const state of [
      PollState.DRAFT,
      PollState.SUBMITTED,
      PollState.READY,
    ]) {
      const actions = getPollLifecycleActions({
        state,
        isCreator: true,
        canManage: true,
        isParentArchived: true,
      });

      expect(Object.values(actions).some(Boolean)).toBe(false);
    }
  });

  // An open poll has no electorate to freeze, so the SUBMITTED step means
  // "mark ready" instead — same gate, different vocabulary, which
  // getPollControlLabelKeys supplies.
  it('gates an open poll on submission exactly like an organization poll', () => {
    const draft = getPollLifecycleActions({
      state: PollState.DRAFT,
      ...admin,
      isParentArchived: false,
    });
    const submitted = getPollLifecycleActions({
      state: PollState.SUBMITTED,
      ...admin,
      isParentArchived: false,
    });

    expect(draft.prepare).toBe(false);
    expect(submitted.prepare).toBe(true);
    expect(getPollControlLabelKeys(true).prepare).toBe('type.markReady');
    expect(getPollControlLabelKeys(false).prepare).toBe('takeSnapshot');
  });
});

describe('getReturnToDraftLabelKeys', () => {
  it('reads as a recall for the author and a hand-back for an admin', () => {
    expect(getReturnToDraftLabelKeys(true).action).toBe('submit.recall');
    expect(getReturnToDraftLabelKeys(false).action).toBe(
      'submit.returnToAuthor'
    );
  });
});

describe('canViewPollPage', () => {
  // The bug: a submitted poll is uneditable by everyone, so gating the page
  // load on "can edit" stopped the author's load early and rendered the whole
  // page from empty defaults — blank title, blank dates, "no questions",
  // and a DRAFT-state hint on a poll that had already been submitted.
  it('lets the author in even when nobody can edit the poll', () => {
    expect(canViewPollPage({ isCreator: true, canManage: false })).toBe(true);
  });

  it('lets an admin in', () => {
    expect(canViewPollPage({ isCreator: false, canManage: true })).toBe(true);
  });

  it('keeps everyone else out', () => {
    expect(canViewPollPage({ isCreator: false, canManage: false })).toBe(false);
  });
});

describe('canSeeResultsBeforePollEnds', () => {
  // Mirrors canViewResults in PollResultsPolicy: an anonymous poll's results
  // are admin-only until it finishes, so offering the link to its own author
  // sent them to a page that refuses them.
  it('withholds a running anonymous poll from a non-admin', () => {
    expect(
      canSeeResultsBeforePollEnds({ canManage: false, isAnonymous: true })
    ).toBe(false);
  });

  it('opens a running named poll to a non-admin', () => {
    expect(
      canSeeResultsBeforePollEnds({ canManage: false, isAnonymous: false })
    ).toBe(true);
  });

  it('always allows an admin', () => {
    expect(
      canSeeResultsBeforePollEnds({ canManage: true, isAnonymous: true })
    ).toBe(true);
  });
});
