'use client';

import { useState, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import {
  getUserPollsForAdminAction,
  type UserPollResult,
} from '@/web/actions/suspiciousActivity';
import { Link } from '@/src/i18n/routing';
import { PollStateBadge } from '@/src/web/components/polls/PollStateBadge';

interface UserPollsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userName: string;
  initialPolls: UserPollResult[];
  initialTotalCount: number;
  initialLoading: boolean;
  userId: string;
}

export function UserPollsDialog({
  isOpen,
  onClose,
  userName,
  initialPolls,
  initialTotalCount,
  initialLoading,
  userId,
}: UserPollsDialogProps) {
  const t = useTranslations('superadmin.users');
  const [extraPolls, setExtraPolls] = useState<UserPollResult[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const pageRef = useRef(1);

  const polls = [...initialPolls, ...extraPolls];
  const totalCount = initialTotalCount;
  const loading = initialLoading || loadingMore;

  const handleLoadMore = async () => {
    pageRef.current += 1;
    setLoadingMore(true);
    const result = await getUserPollsForAdminAction({
      userId,
      page: pageRef.current,
    });

    if (result.success) {
      setExtraPolls((prev) => [...prev, ...result.data.polls]);
    }

    setLoadingMore(false);
  };

  const handleClose = () => {
    setExtraPolls([]);
    pageRef.current = 1;
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('pollsDialogTitle', { name: userName })}</DialogTitle>
      <DialogBody>
        {polls.length === 0 && loading ? (
          <Text className="text-sm text-zinc-500">{t('pollsLoading')}</Text>
        ) : polls.length === 0 ? (
          <Text className="text-sm text-zinc-500">{t('pollsEmpty')}</Text>
        ) : (
          <div className="space-y-2">
            {polls.map((poll) => (
              <Link
                key={poll.id}
                href={`/polls/${poll.id}/results`}
                prefetch={false}
                className="block rounded-lg border border-zinc-200 p-3 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
              >
                <div className="flex items-center gap-2">
                  <span className="font-medium">{poll.title}</span>
                  <PollStateBadge state={poll.state} />
                </div>
                <div className="text-sm text-zinc-500">
                  {poll.organizationName} &middot;{' '}
                  {new Date(poll.createdAt).toLocaleDateString()}
                </div>
              </Link>
            ))}
            {polls.length < totalCount && (
              <Button
                plain
                onClick={handleLoadMore}
                disabled={loading}
                className="w-full text-center"
              >
                {loading ? t('pollsLoading') : t('loadMore')}
              </Button>
            )}
          </div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={handleClose}>
          {t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
