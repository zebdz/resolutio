import { PollState } from '@/domain/poll/PollState';

/**
 * Translation keys for the two admin buttons that move a poll between DRAFT
 * and READY. Keys are relative to the `poll` namespace, which is what both
 * PollControls and PollCard pass to useTranslations.
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
  revert: 'type.backToDraft',
  reverting: 'type.returningToDraft',
  reverted: 'type.returnedToDraft',
  confirmRevert: 'type.confirmBackToDraft',
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
