'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PencilIcon, EyeIcon } from '@heroicons/react/24/outline';
import { PollStateBadge } from '@/src/web/components/polls/PollStateBadge';
import { stripMarkdownToPlainText } from '@/application/shared/StripMarkdownToPlainText';
import {
  takeSnapshotAction,
  discardSnapshotAction,
  activatePollAction,
  deactivatePollAction,
  finishPollAction,
} from '@/src/web/actions/poll/poll';
import { toast } from 'sonner';
import {
  getPollControlLabelKeys,
  getPollOpenMode,
  shouldShowManageParticipants,
} from '@/src/web/components/polls/pollControlLabels';

interface PollCardProps {
  poll: any;
  userId: string;
  canManage: boolean;
  onPollStateChange: () => void;
}

export function PollCard({
  poll,
  userId,
  canManage,
  onPollStateChange,
}: PollCardProps) {
  const t = useTranslations('poll');
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
  const isFinished = poll.state === 'FINISHED';
  const isCreator = poll.createdBy === userId;
  const isOpenPoll = poll.pollType === 'OPEN';
  const isAnonymousPoll = !!poll.anonymous;
  const isOrgArchived = poll.isOrgArchived;
  const isBoardArchived = poll.isBoardArchived;
  const isParentArchived = isOrgArchived || isBoardArchived;
  const labelKeys = getPollControlLabelKeys(isOpenPoll);

  // The page decides for itself whether it opens editable or read-only; the
  // icon only says which one to expect.
  const openMode = getPollOpenMode({
    isCreator,
    canManage,
    state: poll.state,
    isParentArchived,
  });
  const canManageParticipants = canManage;
  const canActivateAndDeactivatePoll = canManage;
  // A named poll is readable by every member while it runs — the card must
  // offer the link. The results page enforces the rule server-side regardless.
  const canViewResultsBeforePollEnds = canManage || !isAnonymousPoll;

  const handleTakeSnapshot = async () => {
    if (!confirm(t(labelKeys.confirmPrepare))) {
      return;
    }

    setIsTakingSnapshot(true);

    try {
      const result = await takeSnapshotAction(poll.id);

      if (result.success) {
        toast.success(t(labelKeys.prepared));
        onPollStateChange();
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
    if (!confirm(t(labelKeys.confirmRevert))) {
      return;
    }

    setIsDiscardingSnapshot(true);

    try {
      const result = await discardSnapshotAction(poll.id);

      if (result.success) {
        toast.success(t(labelKeys.reverted));
        onPollStateChange();
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
        onPollStateChange();
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
        onPollStateChange();
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(t('errors.generic'));
    } finally {
      setIsActivating(false);
    }
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/polls/${poll.id}/vote`;

    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('type.linkCopied'));
    } catch {
      toast.error(t('type.copyLinkError'));
    }
  };

  const handleFinish = async () => {
    setIsFinishing(true);

    try {
      const result = await finishPollAction(poll.id);

      if (result.success) {
        toast.success(t('pollFinished'));
        onPollStateChange();
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
    <div
      className={`relative p-6 rounded-lg border transition-colors ${
        isParentArchived
          ? 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950'
          : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700'
      }`}
    >
      {/* Edit for the author, read-only for any other admin */}
      {openMode !== 'none' && (
        <Link
          href={`/polls/${poll.id}/edit`}
          className="absolute top-4 right-4 p-2 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md transition-colors"
          title={openMode === 'edit' ? t('editPoll') : t('viewPoll')}
        >
          {openMode === 'edit' ? (
            <PencilIcon className="w-5 h-5" />
          ) : (
            <EyeIcon className="w-5 h-5" />
          )}
        </Link>
      )}

      <div className="space-y-4">
        {/* Title and status */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 pr-8">
            {poll.title}
          </h3>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <PollStateBadge state={poll.state} />
            {isOpenPoll && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-sky-700 bg-sky-100 dark:text-sky-300 dark:bg-sky-900/40 rounded-full">
                {t('type.openBadge')}
              </span>
            )}
            {/* Both states get a badge: a voter must never have to infer
                whether their ballot will carry their name. */}
            <span
              className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full ${
                isAnonymousPoll
                  ? 'text-zinc-700 bg-zinc-100 dark:text-zinc-300 dark:bg-zinc-800'
                  : 'text-amber-700 bg-amber-100 dark:text-amber-300 dark:bg-amber-900/40'
              }`}
            >
              {isAnonymousPoll
                ? t('anonymous.anonymousBadge')
                : t('anonymous.namedBadge')}
            </span>
            {isOrgArchived && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-pink-700 bg-pink-200 dark:text-pink-400 dark:bg-pink-900/40 rounded-full">
                {t('orgArchived')}
              </span>
            )}
            {isBoardArchived && !isOrgArchived && (
              <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-pink-700 bg-pink-200 dark:text-pink-400 dark:bg-pink-900/40 rounded-full">
                {t('boardArchived')}
              </span>
            )}
          </div>
        </div>

        {/* Organization and board */}
        <div className="text-xs text-zinc-500 dark:text-zinc-400">
          {poll.organizationName}
          {poll.boardName && <span> &rsaquo; {poll.boardName}</span>}
        </div>

        {/* Description */}
        {/* Stripped, not rendered: the card shows two clamped lines, so raw
            markdown would surface as literal `![photo](/api/…)` text. */}
        {poll.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
            {stripMarkdownToPlainText(poll.description)}
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
          <div className="flex flex-wrap gap-2">
            {/* Vote button for participants on active polls */}
            {!isParentArchived &&
              isActive &&
              poll.canVote &&
              !poll.hasFinishedVoting && (
                <Link href={`/polls/${poll.id}/vote`} className="flex-1">
                  <Button color="brand-green" className="w-full">
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

            {/* Copy the voting link — the only way an open poll is shared */}
            {isOpenPoll && canManage && (
              <Button
                color="zinc"
                onClick={handleCopyLink}
                className="flex-1 cursor-pointer"
              >
                {t('type.copyLink')}
              </Button>
            )}

            {/* Manage participants */}
            {canManageParticipants &&
              shouldShowManageParticipants(isOpenPoll, poll.state) && (
                <Link
                  href={`/polls/${poll.id}/participants`}
                  className="flex-1"
                >
                  <Button color="zinc" className="w-full text-sm">
                    {t('manageParticipants')}
                  </Button>
                </Link>
              )}
          </div>

          {/* Take Snapshot button for DRAFT polls */}
          {!isParentArchived && canActivateAndDeactivatePoll && isDraft && (
            <Button
              color="brand-green"
              onClick={handleTakeSnapshot}
              disabled={isTakingSnapshot}
              className="w-full"
            >
              {isTakingSnapshot ? t(labelKeys.preparing) : t(labelKeys.prepare)}
            </Button>
          )}

          {/* Activate and Discard Snapshot buttons for READY polls */}
          {!isParentArchived && canActivateAndDeactivatePoll && isReady && (
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
                  ? t(labelKeys.reverting)
                  : t(labelKeys.revert)}
              </Button>
            </>
          )}

          {/* Deactivate and Finish buttons for ACTIVE polls */}
          {!isParentArchived && canActivateAndDeactivatePoll && isActive && (
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
