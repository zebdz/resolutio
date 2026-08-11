import { PollState } from '@/domain/poll/PollState';

/**
 * Translation keys for the two admin buttons that move a poll between
 * SUBMITTED and READY. Keys are relative to the `poll` namespace, which is
 * what both PollControls and PollCard pass to useTranslations.
 *
 * The two poll types name the same transition differently because it means
 * different things. An organization poll really does freeze an electorate
 * here. An open poll has none — every verified user may vote — so for it the
 * step only means "validated and awaiting activation".
 */
export interface PollControlLabelKeys {
  prepare: string;
  preparing: string;
  prepared: string;
  confirmPrepare: string;
  revert: string;
  reverting: string;
  reverted: string;
  confirmRevert: string;
}

const ORGANIZATION_KEYS: PollControlLabelKeys = {
  prepare: 'takeSnapshot',
  preparing: 'takingSnapshot',
  prepared: 'snapshotTaken',
  confirmPrepare: 'confirmTakeSnapshot',
  revert: 'discardSnapshot',
  reverting: 'discardingSnapshot',
  reverted: 'snapshotDiscarded',
  confirmRevert: 'confirmDiscardSnapshot',
};

const OPEN_KEYS: PollControlLabelKeys = {
  prepare: 'type.markReady',
  preparing: 'type.markingReady',
  prepared: 'type.markedReady',
  confirmPrepare: 'type.confirmMarkReady',
  revert: 'type.backToReview',
  reverting: 'type.returningToReview',
  reverted: 'type.returnedToReview',
  confirmRevert: 'type.confirmBackToReview',
};

export function getPollControlLabelKeys(
  isOpenPoll: boolean
): PollControlLabelKeys {
  return isOpenPoll ? OPEN_KEYS : ORGANIZATION_KEYS;
}

/**
 * READY is the one state where an admin might expect a frozen participant
 * list and find none, so that is the only place the explanation earns space.
 */
export function shouldShowReadyHint(
  isOpenPoll: boolean,
  state: string
): boolean {
  return isOpenPoll && state === PollState.READY;
}

/**
 * An open poll's participants are created as voters finish voting, so before
 * ACTIVE the page is guaranteed empty. The page itself stays reachable by URL.
 */
export function shouldShowManageParticipants(
  isOpenPoll: boolean,
  state: string
): boolean {
  if (!isOpenPoll) {
    return true;
  }

  return state === PollState.ACTIVE || state === PollState.FINISHED;
}

/**
 * Which lifecycle buttons a given viewer may see on a given poll.
 *
 * One place decides this for both PollCard and PollControls, because the two
 * surfaces have to agree: a poll an admin can act on from the list must be one
 * they can act on from the poll page.
 *
 * The rule the states encode: DRAFT belongs to the author and no admin action
 * exists yet; SUBMITTED is the handover, and the first point an admin may
 * freeze participants; everything from READY on is the admin's.
 */
export interface PollLifecycleActions {
  /** Author hands the poll over. DRAFT only. */
  submit: boolean;
  /** Author recalls, or an admin sends it back for changes. SUBMITTED only. */
  returnToDraft: boolean;
  /**
   * Author copies a link to the poll to send an admin directly. SUBMITTED
   * only: before that there is nothing to review, and afterwards the poll has
   * already been picked up.
   */
  copyReviewLink: boolean;
  /** Freeze participants / mark ready. SUBMITTED only — never on a draft. */
  prepare: boolean;
  /** Undo the freeze. READY only. */
  revert: boolean;
  activate: boolean;
  deactivate: boolean;
  finish: boolean;
}

const NO_ACTIONS: PollLifecycleActions = {
  submit: false,
  returnToDraft: false,
  copyReviewLink: false,
  prepare: false,
  revert: false,
  activate: false,
  deactivate: false,
  finish: false,
};

export function getPollLifecycleActions(input: {
  state: string;
  isCreator: boolean;
  canManage: boolean;
  isParentArchived: boolean;
}): PollLifecycleActions {
  // An archived org or board freezes its polls wholesale; the server refuses
  // these transitions anyway, so offering them would only produce errors.
  if (input.isParentArchived) {
    return NO_ACTIONS;
  }

  switch (input.state) {
    case PollState.DRAFT:
      return { ...NO_ACTIONS, submit: input.isCreator };

    case PollState.SUBMITTED:
      return {
        ...NO_ACTIONS,
        // Same transition either way: the author changed their mind, or the
        // admin wants changes.
        returnToDraft: input.isCreator || input.canManage,
        copyReviewLink: input.isCreator,
        prepare: input.canManage,
      };

    case PollState.READY:
      return {
        ...NO_ACTIONS,
        revert: input.canManage,
        activate: input.canManage,
      };

    case PollState.ACTIVE:
      return {
        ...NO_ACTIONS,
        deactivate: input.canManage,
        finish: input.canManage,
      };

    default:
      return NO_ACTIONS;
  }
}

/**
 * The same button reads differently depending on who is pressing it: the
 * author is taking their poll back, the admin is handing it over.
 */
export function getReturnToDraftLabelKeys(isCreator: boolean): {
  action: string;
  pending: string;
  done: string;
  confirm: string;
} {
  return isCreator
    ? {
        action: 'submit.recall',
        pending: 'submit.recalling',
        done: 'submit.recalled',
        confirm: 'submit.confirmRecall',
      }
    : {
        action: 'submit.returnToAuthor',
        pending: 'submit.returning',
        done: 'submit.returned',
        confirm: 'submit.confirmReturn',
      };
}

/**
 * Whether a viewer may see the poll page at all, as opposed to edit it.
 *
 * Distinct from editability on purpose: a submitted poll is uneditable by
 * everyone, yet its author still has to reach the page to recall it. Reading
 * the two as one thing left the author on a page rendered from empty defaults
 * — no title, no dates, no questions — because the load stopped early.
 */
export function canViewPollPage(input: {
  isCreator: boolean;
  canManage: boolean;
}): boolean {
  return input.isCreator || input.canManage;
}

/**
 * Whether to offer the results of a poll that has not finished yet.
 *
 * Mirrors canViewResults in PollResultsPolicy, which refuses a non-admin the
 * results of an anonymous poll while it is still running — the secrecy is the
 * point of the flag. A named poll is open to the organization as it runs.
 * Offering the link anyway sends the author of an anonymous poll to a page
 * that refuses them.
 */
export function canSeeResultsBeforePollEnds(input: {
  canManage: boolean;
  isAnonymous: boolean;
}): boolean {
  return input.canManage || !input.isAnonymous;
}

export type PollOpenMode = 'edit' | 'read' | 'none';

/**
 * How — if at all — a card offers to open the poll page.
 *
 * Editing belongs to the author and mirrors the server rule: anything but
 * ACTIVE or FINISHED, and not under an archived org or board. Reading belongs
 * to admins, in every state, because the poll page is the only place the AI
 * legality check is exposed and that check is an admin capability. Without
 * the read branch an admin who did not write the poll had no way in at all.
 */
export function getPollOpenMode(input: {
  isCreator: boolean;
  canManage: boolean;
  state: string;
  isParentArchived: boolean;
}): PollOpenMode {
  const isEditableState =
    input.state !== PollState.ACTIVE && input.state !== PollState.FINISHED;

  if (!input.isParentArchived && input.isCreator && isEditableState) {
    return 'edit';
  }

  if (input.canManage) {
    return 'read';
  }

  return 'none';
}
