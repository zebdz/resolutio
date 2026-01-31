'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import {
  ClockIcon,
  CalendarIcon,
  PencilIcon,
} from '@heroicons/react/24/outline';
import {
  takeSnapshotAction,
  discardSnapshotAction,
  activatePollAction,
  deactivatePollAction,
  finishPollAction,
} from '@/web/actions/poll';
import { toast } from 'sonner';

interface PollCardProps {
  poll: any;
  userId: string;
  canManage: boolean;
}

export function PollCard({ poll, userId, canManage }: PollCardProps) {
  const t = useTranslations('poll');
  const router = useRouter();
  const [isTakingSnapshot, setIsTakingSnapshot] = useState(false);
  const [isDiscardingSnapshot, setIsDiscardingSnapshot] = useState(false);
  const [isDeactivating, setIsDeactivating] = useState(false);
  const [isActivating, setIsActivating] = useState(false);
  const [isFinishing, setIsFinishing] = useState(false);

  const now = new Date();
  const startDate = new Date(poll.startDate);
  const endDate = new Date(poll.endDate);
  const isActive = poll.state === 'ACTIVE';
  const isDraft = poll.state === 'DRAFT';
  const isReady = poll.state === 'READY';
  const isUpcoming = isDraft || isReady;
  const isFinished = poll.state === 'FINISHED';
  const isCreator = poll.createdBy === userId;

  const canEditPoll = isCreator;
  const canManageParticipants = canManage;
  const canActivateAndDeactivatePoll = canManage;
  const canViewResultsBeforePollEnds = canManage;

  const handleTakeSnapshot = async () => {
    if (!confirm(t('confirmTakeSnapshot'))) {
      return;
    }

    setIsTakingSnapshot(true);

    try {
      const result = await takeSnapshotAction(poll.id);

      if (result.success) {
        toast.success(t('snapshotTaken'));
        router.refresh();
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
    if (!confirm(t('confirmDiscardSnapshot'))) {
      return;
    }

    setIsDiscardingSnapshot(true);

    try {
      const result = await discardSnapshotAction(poll.id);

      if (result.success) {
        toast.success(t('snapshotDiscarded'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsDiscardingSnapshot(false);
    }
  };

  const handleDeactivate = async () => {
    if (!confirm(t('confirmDeactivatePoll'))) {
      return;
    }

    setIsDeactivating(true);

    try {
      const result = await deactivatePollAction(poll.id);

      if (result.success) {
        toast.success(t('pollDeactivated'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsDeactivating(false);
    }
  };

  const handleActivate = async () => {
    if (!confirm(t('confirmActivatePoll'))) {
      return;
    }

    setIsActivating(true);

    try {
      const result = await activatePollAction(poll.id);

      if (result.success) {
        toast.success(t('pollActivated'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsActivating(false);
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);

    try {
      const result = await finishPollAction(poll.id);

      if (result.success) {
        toast.success(t('pollFinished'));
        router.refresh();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsFinishing(false);
    }
  };

  return (
    <div className="relative p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
      {/* Edit button for creator if poll can be edited */}
      {canEditPoll && !isActive && !isFinished && (
        <Link
          href={`/polls/${poll.id}/edit`}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          title={t('editPoll')}
        >
          <PencilIcon className="w-5 h-5" />
        </Link>
      )}

      <div className="space-y-4">
        {/* Title and status */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 pr-8">
            {poll.title}
          </h3>
          <div className="mt-1">
            {isActive && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20 rounded-full">
                <ClockIcon className="w-3 h-3" />
                {t('active')}
              </span>
            )}
            {isUpcoming && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20 rounded-full">
                <CalendarIcon className="w-3 h-3" />
                {t('upcoming')}
              </span>
            )}
            {isFinished && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-500 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800 rounded-full">
                {t('finished')}
              </span>
            )}
          </div>
        </div>

        {/* Description */}
        {poll.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {poll.description}
          </p>
        )}

        {/* Stats */}
        <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
          <span>
            {t('questionsNumber')} {poll.questions?.length || 0}{' '}
          </span>
          <span>•</span>
          <span>{endDate.toLocaleDateString()}</span>
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-2 pt-2">
          <div className="flex gap-2">
            {/* Vote button for participants on active polls */}
            {isActive && poll.canVote && !poll.hasFinishedVoting && (
              <Link href={`/polls/${poll.id}/vote`} className="flex-1">
                <Button color="blue" className="w-full">
                  {t('vote')}
                </Button>
              </Link>
            )}

            {/* Results button */}
            {(isFinished || canViewResultsBeforePollEnds) && (
              <Link href={`/polls/${poll.id}/results`} className="flex-1">
                <Button color="zinc" className="w-full">
                  {t('viewResults')}
                </Button>
              </Link>
            )}

            {/* Manage participants */}
            {canManageParticipants && (
              <Link href={`/polls/${poll.id}/participants`} className="flex-1">
                <Button color="zinc" className="w-full text-sm">
                  {t('manageParticipants')}
                </Button>
              </Link>
            )}
          </div>

          {/* Take Snapshot button for DRAFT polls */}
          {canActivateAndDeactivatePoll && isDraft && (
            <Button
              color="blue"
              onClick={handleTakeSnapshot}
              disabled={isTakingSnapshot}
              className="w-full"
            >
              {isTakingSnapshot ? t('takingSnapshot') : t('takeSnapshot')}
            </Button>
          )}

          {/* Activate and Discard Snapshot buttons for READY polls */}
          {canActivateAndDeactivatePoll && isReady && (
            <>
              <Button
                color="green"
                onClick={handleActivate}
                disabled={isActivating}
                className="w-full"
              >
                {isActivating ? t('activating') : t('activatePoll')}
              </Button>
              <Button
                color="zinc"
                onClick={handleDiscardSnapshot}
                disabled={isDiscardingSnapshot}
                className="w-full"
              >
                {isDiscardingSnapshot
                  ? t('discardingSnapshot')
                  : t('discardSnapshot')}
              </Button>
            </>
          )}

          {/* Deactivate and Finish buttons for ACTIVE polls */}
          {canActivateAndDeactivatePoll && isActive && (
            <>
              <Button
                color="yellow"
                onClick={handleDeactivate}
                disabled={isDeactivating}
                className="w-full"
              >
                {isDeactivating ? t('deactivating') : t('deactivatePoll')}
              </Button>
              <Button
                color="red"
                onClick={handleFinish}
                disabled={isFinishing}
                className="w-full"
              >
                {isFinishing ? t('finishing') : t('finishPoll')}
              </Button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
