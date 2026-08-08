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
} from '@/src/web/actions/poll/poll';
import { toast } from 'sonner';
import { Link } from '@/src/i18n/routing';
import { PollState } from '@/src/domain/poll/PollState';
import {
  getPollControlLabelKeys,
  shouldShowReadyHint,
  shouldShowManageParticipants,
} from '@/src/web/components/polls/pollControlLabels';

interface PollControlsProps {
  pollId: string;
  state: PollState;
  hasQuestions: boolean;
  isOpenPoll: boolean;
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
  onStateChange,
  onNoLongerEditable,
}: PollControlsProps) {
  const t = useTranslations('poll');
  const labelKeys = getPollControlLabelKeys(isOpenPoll);
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
          </div>

          <div className="flex flex-wrap gap-2">
            {state === 'DRAFT' && (
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

            {state === 'READY' && (
              <>
                <Button
                  color="green"
                  onClick={handleActivate}
                  disabled={isActivating}
                >
                  {isActivating ? t('activating') : t('activatePoll')}
                </Button>
                <Button
                  color="zinc"
                  onClick={handleDiscardSnapshot}
                  disabled={isDiscardingSnapshot}
                >
                  {isDiscardingSnapshot
                    ? t(labelKeys.reverting)
                    : t(labelKeys.revert)}
                </Button>
              </>
            )}

            {state === 'ACTIVE' && (
              <>
                <Button
                  color="yellow"
                  onClick={handleDeactivate}
                  disabled={isDeactivating}
                >
                  {isDeactivating ? t('deactivating') : t('deactivatePoll')}
                </Button>
                <Button
                  color="red"
                  onClick={() => setShowFinishDialog(true)}
                  disabled={isFinishing}
                >
                  {t('finishPoll')}
                </Button>
              </>
            )}

            {shouldShowManageParticipants(isOpenPoll, state) && (
              <Link href={`/polls/${pollId}/participants`}>
                <Button color="zinc">{t('manageParticipants')}</Button>
              </Link>
            )}

            {state === 'ACTIVE' && (
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
