'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Text } from '@/app/components/catalyst/text';
import { Textarea } from '@/app/components/catalyst/textarea';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import {
  searchUsersForAdminAction,
  blockUserAction,
  unblockUserAction,
  getUserBlockHistoryAction,
  type AdminUserResult,
  type UserBlockHistoryEntry,
} from '@/web/actions/suspiciousActivity';
import { BlockUserDialog } from './BlockUserDialog';
import { BlockHistoryDialog } from './BlockHistoryDialog';
import { User } from '@/domain/user/User';

export function UserManagementPanel() {
  const t = useTranslations('superadmin.users');
  const [query, setQuery] = useState('');
  const [users, setUsers] = useState<AdminUserResult[]>([]);
  const [searched, setSearched] = useState(false);
  const [blockTarget, setBlockTarget] = useState<AdminUserResult | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<AdminUserResult | null>(
    null
  );
  const [unblockReason, setUnblockReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTimer, setSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [historyTarget, setHistoryTarget] = useState<AdminUserResult | null>(
    null
  );
  const [historyEntries, setHistoryEntries] = useState<UserBlockHistoryEntry[]>(
    []
  );

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 3) {
      setUsers([]);
      setSearched(false);

      return;
    }

    const result = await searchUsersForAdminAction({ query: q });

    if (result.success) {
      setUsers(result.data);
      setSearched(true);
    }
  }, []);

  const handleSearchChange = (value: string) => {
    setQuery(value);

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const timer = setTimeout(() => doSearch(value), 500);
    setSearchTimer(timer);
  };

  const handleBlock = async (reason: string) => {
    if (!blockTarget) {
      return;
    }

    const result = await blockUserAction({
      userId: blockTarget.id,
      reason,
    });

    if (result.success) {
      console.log(`[UserManagement] Blocked user ${blockTarget.id}: ${reason}`);
      setBlockTarget(null);

      if (query.length >= 3) {
        await doSearch(query);
      }
    }
  };

  const handleUnblock = async () => {
    if (!unblockTarget) {
      return;
    }

    if (!unblockReason.trim()) {
      setError(t('reasonRequired'));

      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await unblockUserAction({
      userId: unblockTarget.id,
      reason: unblockReason.trim(),
    });

    if (result.success) {
      console.log(`[UserManagement] Unblocked user ${unblockTarget.id}`);
      setUnblockTarget(null);
      setUnblockReason('');

      if (query.length >= 3) {
        await doSearch(query);
      }
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleShowHistory = async (user: AdminUserResult) => {
    setHistoryTarget(user);
    const result = await getUserBlockHistoryAction({ userId: user.id });

    if (result.success) {
      setHistoryEntries(result.data);
    }
  };

  const getUserName = (user: AdminUserResult) =>
    User.formatFullName(user.firstName, user.lastName, user.middleName);

  return (
    <div className="space-y-4">
      <Input
        value={query}
        onChange={(e) => handleSearchChange(e.target.value)}
        placeholder={t('searchPlaceholder')}
      />

      {query.length > 0 && query.length < 3 && (
        <Text className="text-sm text-zinc-500">{t('searchMinChars')}</Text>
      )}

      {searched && users.length === 0 && (
        <Text className="text-sm text-zinc-500">{t('noResults')}</Text>
      )}

      {users.length > 0 && (
        <div className="space-y-2">
          {users.map((user) => (
            <div
              key={user.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-medium">{getUserName(user)}</div>
                  <div className="text-sm text-zinc-500">
                    @{user.nickname} &middot; {user.phoneNumber}
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {user.blockStatus !== null && (
                    <Button
                      plain
                      onClick={() => handleShowHistory(user)}
                      className="text-xs"
                    >
                      {t('history')}
                    </Button>
                  )}
                  {user.blockStatus?.blocked ? (
                    <>
                      <span className="text-sm font-medium text-red-600 dark:text-red-400">
                        {t('blocked')}
                      </span>
                      <Button
                        color="brand-green"
                        onClick={() => setUnblockTarget(user)}
                        className="text-xs"
                      >
                        {t('unblockUser')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className="text-sm font-medium text-green-600 dark:text-green-400">
                        {t('active')}
                      </span>
                      <Button
                        color="red"
                        onClick={() => setBlockTarget(user)}
                        className="text-xs"
                      >
                        {t('blockUser')}
                      </Button>
                    </>
                  )}
                </div>
              </div>

              {user.blockStatus?.blocked && (
                <div className="mt-2 space-y-1 text-sm text-zinc-500">
                  {user.blockStatus.reason && (
                    <div>
                      {t('blockedReason', { reason: user.blockStatus.reason })}
                    </div>
                  )}
                  {user.blockStatus.blockedAt && (
                    <div>
                      {t('blockedAt', {
                        date: new Date(
                          user.blockStatus.blockedAt
                        ).toLocaleDateString(),
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Block dialog */}
      <BlockUserDialog
        isOpen={!!blockTarget}
        onClose={() => setBlockTarget(null)}
        userName={blockTarget ? getUserName(blockTarget) : ''}
        onConfirm={handleBlock}
      />

      {/* Block history dialog */}
      <BlockHistoryDialog
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        title={t('historyTitle', {
          name: historyTarget ? getUserName(historyTarget) : '',
        })}
        entries={historyEntries}
        emptyLabel={t('historyEmpty')}
        blockedLabel={t('statusBlocked')}
        unblockedLabel={t('statusUnblocked')}
        changedByLabel={t('changedBy', { name: '{name}' })}
        closeLabel={t('cancel')}
      />

      {/* Unblock confirm dialog */}
      <Dialog open={!!unblockTarget} onClose={() => setUnblockTarget(null)}>
        <DialogTitle>{t('unblockConfirmTitle')}</DialogTitle>
        <DialogDescription>
          {t('unblockConfirmDescription', {
            name: unblockTarget ? getUserName(unblockTarget) : '',
          })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reasonLabel')}</label>
            <Textarea
              value={unblockReason}
              onChange={(e) => setUnblockReason(e.target.value)}
              placeholder={t('unblockReasonPlaceholder')}
              rows={3}
            />
            {error && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            plain
            onClick={() => setUnblockTarget(null)}
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button
            color="brand-green"
            onClick={handleUnblock}
            disabled={isLoading}
          >
            {t('confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
