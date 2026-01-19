'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import {
  activatePollAction,
  deactivatePollAction,
  finishPollAction,
} from '@/web/actions/poll';
import { toast } from 'sonner';
import { Link } from '@/src/i18n/routing';

interface PollControlsProps {
  pollId: string;
  isActive: boolean;
  isFinished: boolean;
  hasQuestions: boolean;
}

export default function PollControls({
  pollId,
  isActive,
  isFinished,
  hasQuestions,
}: PollControlsProps) {
  const t = useTranslations('poll');
  const router = useRouter();
  const [isActivating, setIsActivating] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);
  const [showFinishDialog, setShowFinishDialog] = useState(false);

  const handleActivate = async () => {
    if (!hasQuestions) {
      toast.error(t('errors.atLeastOneQuestionRequired'));

      return;
    }

    setIsActivating(true);

    try {
      const result = await activatePollAction(pollId);

      if (result.success) {
        toast.success(t('pollActivated'));
        router.push('/polls');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setIsActivating(false);
    }
  };

  const handleDeactivate = async () => {
    setIsDeactivating(true);

    try {
      const result = await deactivatePollAction(pollId);

      if (result.success) {
        toast.success(t('pollDeactivated'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);

    try {
      const result = await finishPollAction(pollId);

      if (result.success) {
        toast.success(t('pollFinished'));
        setShowFinishDialog(false);
        router.push('/polls');
      } else {
        toast.error(result.error);
      }
    } catch (error) {
      toast.error(t('errors.generic'));
    } finally {
      setIsFinishing(false);
    }
  };

  if (isFinished) {
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
              {isActive ? t('active') : t('upcoming')}
            </p>
          </div>

          <div className="flex gap-2">
            {!isActive ? (
              <Button
                color="green"
                onClick={handleActivate}
                disabled={isActivating || !hasQuestions}
              >
                {isActivating ? t('activating') : t('activatePoll')}
              </Button>
            ) : (
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

            <Link href={`/polls/${pollId}/participants`}>
              <Button color="zinc">{t('manageParticipants')}</Button>
            </Link>

            {isActive && (
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
