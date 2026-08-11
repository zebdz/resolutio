'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import {
  takeSnapshotAction,
  discardSnapshotAction,
  activatePollAction,
  deactivatePollAction,
  finishPollAction,
  submitPollToAdminAction,
  returnPollToDraftAction,
} from '@/src/web/actions/poll/poll';
import { toast } from 'sonner';
import { Link } from '@/src/i18n/routing';
import { PollState } from '@/src/domain/poll/PollState';
import {
  canSeeResultsBeforePollEnds,
  getPollControlLabelKeys,
  getPollLifecycleActions,
  getReturnToDraftLabelKeys,
  shouldShowReadyHint,
  shouldShowManageParticipants,
} from '@/src/web/components/polls/pollControlLabels';

interface PollControlsProps {
  pollId: string;
  state: PollState;
  hasQuestions: boolean;
  isOpenPoll: boolean;
  /** Author (or superadmin acting as one): may submit and recall. */
  isCreator: boolean;
  /** Org admin or superadmin: may take the poll from SUBMITTED onwards. */
  canManage: boolean;
  /** Decides whether results are readable before the poll ends. */
  isAnonymous: boolean;
  onStateChange: () => void;
  /**
   * Called after a transition that leaves the poll uneditable — activating or
   * finishing it. Reloading the edit form in place would strand the author on
   * a page that can only tell them the poll is no longer editable, which reads
   * as an error rather than the expected result of what they just did.
   */
  onNoLongerEditable?: (transition: 'activated' | 'finished') => void;
}

export default function PollControls({
  pollId,
  state,
  hasQuestions,
  isOpenPoll,
  isCreator,
  canManage,
  isAnonymous,
  onStateChange,
  onNoLongerEditable,
}: PollControlsProps) {
  const t = useTranslations('poll');
  const labelKeys = getPollControlLabelKeys(isOpenPoll);
  // The edit page has no archived-parent flag; the server refuses those
  // transitions regardless, and an archived poll is not reachable here.
  const actions = getPollLifecycleActions({
    state,
    isCreator,
    canManage,
    isParentArchived: false,
  });
  const returnLabelKeys = getReturnToDraftLabelKeys(isCreator);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isReturning, setIsReturning] = useState(false);
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [isDiscardingSnapshot, setIsDiscardingSnapshot] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  /**
   * After a transition that freezes the poll, navigate instead of reloading.
   *
   * Doing both would flash the error: `onStateChange` re-runs the parent's
   * load, which resolves faster than the route change and paints "this poll
   * cannot be edited" before the redirect lands. The reload is pointless
   * anyway when the page is being left.
   */
  const leaveOrReload = (transition: 'activated' | 'finished'): boolean => {
    if (onNoLongerEditable) {
      onNoLongerEditable(transition);

      return true;
    }

    onStateChange();

    return false;
  };

  /**
   * Reloads in place rather than navigating away like activate and finish do.
   * Submitting locks the content but the poll is still the author's: the page
   * comes back read-only, saying it is with the admins and offering the recall
   * that takes it back.
   */
  const handleSubmit = async () => {
    if (!hasQuestions) {
      toast.error(t('errors.atLeastOneQuestionRequired'));

      return;
    }

    setIsSubmitting(true);

    try {
      const result = await submitPollToAdminAction(pollId);

      if (result.success) {
        toast.success(t('submit.sent'));
        onStateChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * The read-only poll page, not the editor and not the vote page: the
   * recipient is an admin who cannot edit, and this is where the "poll
   * submitted" notification lands too. No locale prefix — the middleware
   * resolves that per reader, which matters when the link is pasted to
   * someone else.
   */
  const handleCopyReviewLink = async () => {
    const url = `${window.location.origin}/polls/${pollId}`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('submit.linkCopied'));
    } catch {
      // Shared with the open-poll copy button: the failure is the same one.
      toast.error(t('type.copyLinkError'));
    }
  };

  const handleReturnToDraft = async () => {
    setIsReturning(true);

    try {
      const result = await returnPollToDraftAction(pollId);

      if (result.success) {
        toast.success(t(returnLabelKeys.done));
        onStateChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsReturning(false);
    }
  };

  const handleTakeSnapshot = async () => {
    if (!hasQuestions) {
      toast.error(t('errors.atLeastOneQuestionRequired'));

      return;
    }

    setIsTakingSnapshot(true);

    try {
      const result = await takeSnapshotAction(pollId);

      if (result.success) {
        toast.success(t(labelKeys.prepared));
        onStateChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsTakingSnapshot(false);
    }
  };

  const handleDiscardSnapshot = async () => {
    setIsDiscardingSnapshot(true);

    try {
      const result = await discardSnapshotAction(pollId);

      if (result.success) {
        toast.success(t(labelKeys.reverted));
        onStateChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsDiscardingSnapshot(false);
    }
  };

  const handleActivate = async () => {
    setIsActivating(true);
    // Stay disabled while the route change is in flight, so the button does
    // not flick back to "activate" and invite a second click.
    let leaving = false;

    try {
      const result = await activatePollAction(pollId);

      if (result.success) {
        toast.success(t('pollActivated'));
        leaving = leaveOrReload('activated');
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      if (!leaving) {
        setIsActivating(false);
      }
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);

    try {
      const result = await deactivatePollAction(pollId);

      if (result.success) {
        toast.success(t('pollDeactivated'));
        onStateChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);
    let leaving = false;

    try {
      const result = await finishPollAction(pollId);

      if (result.success) {
        toast.success(t('pollFinished'));
        setShowFinishDialog(false);
        leaving = leaveOrReload('finished');
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      if (!leaving) {
        setIsFinishing(false);
      }
    }
  };

  const getStatusLabel = () => {
    switch (state) {
      case 'DRAFT':
        return t('upcoming');
      case 'SUBMITTED':
        return t('submitted');
      case 'READY':
        return t('upcoming');
      case 'ACTIVE':
        return t('active');
      case 'FINISHED':
        return t('finished');
      default:
        return '';
    }
  };

  if (state === 'FINISHED') {
    return (
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('pollControls')}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {t('finished')}
            </p>
          </div>
          <Link href={`/polls/${pollId}/results`}>
            <Button color="zinc">{t('viewResults')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-4 bg-white dark:bg-zinc-900">
        <div className="space-y-4">
          <div>
            <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              {t('pollControls')}
            </h3>
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {getStatusLabel()}
            </p>
            {shouldShowReadyHint(isOpenPoll, state) && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('type.readyHint')}
              </p>
            )}
            {/* The handover is the one step whose next move is another
                person's, so both sides get told what they are waiting for. */}
            {state === PollState.DRAFT && isCreator && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('submit.draftHint')}
              </p>
            )}
            {state === PollState.SUBMITTED && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {t('submit.awaitingAdminHint')}
              </p>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {actions.submit && (
              <Button
                color="brand-green"
                onClick={handleSubmit}
                disabled={isSubmitting || !hasQuestions}
              >
                {isSubmitting ? t('submit.sending') : t('submit.send')}
              </Button>
            )}

            {actions.copyReviewLink && (
              <Button
                color="zinc"
                onClick={handleCopyReviewLink}
                className="cursor-pointer"
              >
                {t('submit.copyLink')}
              </Button>
            )}

            {actions.returnToDraft && (
              <Button
                color="zinc"
                onClick={handleReturnToDraft}
                disabled={isReturning}
              >
                {isReturning
                  ? t(returnLabelKeys.pending)
                  : t(returnLabelKeys.action)}
              </Button>
            )}

            {/* Freezes the electorate for an organization poll; for an open
                poll there is none, so the same step only marks it ready. */}
            {actions.prepare && (
              <Button
                color="brand-green"
                onClick={handleTakeSnapshot}
                disabled={isTakingSnapshot || !hasQuestions}
              >
                {isTakingSnapshot
                  ? t(labelKeys.preparing)
                  : t(labelKeys.prepare)}
              </Button>
            )}

            {actions.activate && (
              <Button
                color="green"
                onClick={handleActivate}
                disabled={isActivating}
              >
                {isActivating ? t('activating') : t('activatePoll')}
              </Button>
            )}

            {actions.revert && (
              <Button
                color="zinc"
                onClick={handleDiscardSnapshot}
                disabled={isDiscardingSnapshot}
              >
                {isDiscardingSnapshot
                  ? t(labelKeys.reverting)
                  : t(labelKeys.revert)}
              </Button>
            )}

            {actions.deactivate && (
              <Button
                color="yellow"
                onClick={handleDeactivate}
                disabled={isDeactivating}
              >
                {isDeactivating ? t('deactivating') : t('deactivatePoll')}
              </Button>
            )}

            {actions.finish && (
              <Button
                color="red"
                onClick={() => setShowFinishDialog(true)}
                disabled={isFinishing}
              >
                {t('finishPoll')}
              </Button>
            )}

            {/* Managing the electorate is an admin power, and this panel is
                now shown to authors too. The participants page redirects a
                non-admin away, so offering it here was a dead end. */}
            {canManage && shouldShowManageParticipants(isOpenPoll, state) && (
              <Link href={`/polls/${pollId}/participants`}>
                <Button color="zinc">{t('manageParticipants')}</Button>
              </Link>
            )}

            {state === PollState.ACTIVE &&
              canSeeResultsBeforePollEnds({ canManage, isAnonymous }) && (
                <Link href={`/polls/${pollId}/results`}>
                  <Button color="zinc">{t('viewResults')}</Button>
                </Link>
              )}
          </div>
        </div>
      </div>

      {/* Finish confirmation dialog */}
      <Dialog
        open={showFinishDialog}
        onClose={() => setShowFinishDialog(false)}
      >
        <DialogTitle>{t('confirmFinishPoll')}</DialogTitle>
        <DialogDescription>
          {t('confirmFinishPollDescription')}
        </DialogDescription>
        <DialogActions>
          <Button
            color="zinc"
            onClick={() => setShowFinishDialog(false)}
            disabled={isFinishing}
          >
            {t('cancel')}
          </Button>
          <Button color="red" onClick={handleFinish} disabled={isFinishing}>
            {isFinishing ? t('finishing') : t('finishPoll')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
