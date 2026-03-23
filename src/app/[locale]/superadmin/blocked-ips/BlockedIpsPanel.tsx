'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import { Text } from '@/src/web/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import {
  getBlockedIpsAction,
  searchBlockedIpsAction,
  blockIpAction,
  unblockIpAction,
  getIpBlockHistoryAction,
  type BlockedIpEntry,
  type IpBlockHistoryEntry,
} from '@/src/web/actions/superadmin/ipBlockAdmin';
import { User } from '@/domain/user/User';

const PAGE_SIZE = 20;

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString();
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString();
}

export function BlockedIpsPanel() {
  const t = useTranslations('superadmin.blockedIps');
  const [items, setItems] = useState<BlockedIpEntry[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchTimer, setSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Block IP dialog
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const [blockIpAddress, setBlockIpAddress] = useState('');
  const [blockReason, setBlockReason] = useState('');
  const [blockError, setBlockError] = useState<string | null>(null);
  const [isBlocking, setIsBlocking] = useState(false);

  // Unblock dialog
  const [unblockTarget, setUnblockTarget] = useState<BlockedIpEntry | null>(
    null
  );
  const [unblockReason, setUnblockReason] = useState('');
  const [unblockError, setUnblockError] = useState<string | null>(null);
  const [isUnblocking, setIsUnblocking] = useState(false);

  // History dialog
  const [historyIp, setHistoryIp] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<IpBlockHistoryEntry[]>(
    []
  );

  const fetchItems = useCallback(async (p: number) => {
    const result = await getBlockedIpsAction({ page: p, pageSize: PAGE_SIZE });

    if (result.success) {
      if (p === 1) {
        setItems(result.data.items);
      } else {
        setItems((prev) => [...prev, ...result.data.items]);
      }

      setHasMore(result.data.items.length === PAGE_SIZE);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getBlockedIpsAction({ page: 1, pageSize: PAGE_SIZE }).then((result) => {
      if (!cancelled && result.success) {
        setItems(result.data.items);
        setHasMore(result.data.items.length === PAGE_SIZE);
        setLoaded(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleSearchChange = (value: string) => {
    setQuery(value);

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    if (value.length < 3) {
      setIsSearching(false);
      fetchItems(1);
      setPage(1);

      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      const result = await searchBlockedIpsAction({ query: value });

      if (result.success) {
        setItems(result.data);
        setHasMore(false);
      }

      setIsSearching(false);
    }, 500);
    setSearchTimer(timer);
  };

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    fetchItems(next);
  };

  const handleBlockIp = async () => {
    if (!blockIpAddress.trim()) {
      setBlockError(t('ipRequired'));

      return;
    }

    if (!blockReason.trim()) {
      setBlockError(t('reasonRequired'));

      return;
    }

    setIsBlocking(true);
    setBlockError(null);
    const result = await blockIpAction({
      ipAddress: blockIpAddress.trim(),
      reason: blockReason.trim(),
    });

    if (result.success) {
      setShowBlockDialog(false);
      setBlockIpAddress('');
      setBlockReason('');
      setPage(1);
      await fetchItems(1);
    } else {
      setBlockError(result.error);
    }

    setIsBlocking(false);
  };

  const handleUnblock = async () => {
    if (!unblockTarget) {
      return;
    }

    if (!unblockReason.trim()) {
      setUnblockError(t('reasonRequired'));

      return;
    }

    setIsUnblocking(true);
    setUnblockError(null);
    const result = await unblockIpAction({
      ipAddress: unblockTarget.ipAddress,
      reason: unblockReason.trim(),
    });

    if (result.success) {
      setUnblockTarget(null);
      setUnblockReason('');
      setPage(1);
      await fetchItems(1);
    } else {
      setUnblockError(result.error);
    }

    setIsUnblocking(false);
  };

  const handleShowHistory = async (ip: string) => {
    setHistoryIp(ip);
    const result = await getIpBlockHistoryAction({ ipAddress: ip });

    if (result.success) {
      setHistoryEntries(result.data);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <Input
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
          />
        </div>
        <Button color="red" onClick={() => setShowBlockDialog(true)}>
          {t('blockIp')}
        </Button>
      </div>

      {query.length > 0 && query.length < 3 && (
        <Text className="text-sm text-zinc-500">{t('searchMinChars')}</Text>
      )}

      {loaded && items.length === 0 && !isSearching && (
        <Text className="text-sm text-zinc-500">
          {query.length >= 3 ? t('noResults') : t('noBlockedIps')}
        </Text>
      )}

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.ipAddress}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <div className="font-mono font-medium">{item.ipAddress}</div>
                  <div className="mt-1 space-y-0.5 text-sm text-zinc-500">
                    {item.status === 'blocked' ? (
                      <span className="font-medium text-red-600 dark:text-red-400">
                        {t('blocked')}
                      </span>
                    ) : (
                      <span className="font-medium text-green-600 dark:text-green-400">
                        {t('statusUnblocked')}
                      </span>
                    )}
                    {item.reason && (
                      <div>{t('blockedReason', { reason: item.reason })}</div>
                    )}
                    <div>
                      {t('blockedAt', {
                        date: formatDate(item.createdAt),
                      })}
                    </div>
                    <div>
                      {t('blockedBy', {
                        name: User.formatFullName(
                          item.statusChangedBy.firstName,
                          item.statusChangedBy.lastName,
                          item.statusChangedBy.middleName
                        ),
                      })}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    plain
                    onClick={() => handleShowHistory(item.ipAddress)}
                    className="text-xs"
                  >
                    {t('history')}
                  </Button>
                  {item.status === 'blocked' && (
                    <Button
                      color="brand-green"
                      onClick={() => setUnblockTarget(item)}
                      className="text-xs"
                    >
                      {t('unblockIp')}
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {hasMore && (
        <div className="text-center">
          <Button plain onClick={handleLoadMore}>
            {t('loadMore')}
          </Button>
        </div>
      )}

      {/* Block IP dialog */}
      <Dialog open={showBlockDialog} onClose={() => setShowBlockDialog(false)}>
        <DialogTitle>{t('blockConfirmTitle')}</DialogTitle>
        <DialogDescription>{t('blockConfirmDescription')}</DialogDescription>
        <DialogBody>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">{t('ipAddress')}</label>
              <Input
                value={blockIpAddress}
                onChange={(e) => setBlockIpAddress(e.target.value)}
                placeholder={t('ipAddressPlaceholder')}
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('reason')}</label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder={t('reasonPlaceholder')}
                rows={3}
              />
            </div>
            {blockError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {blockError}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            plain
            onClick={() => setShowBlockDialog(false)}
            disabled={isBlocking}
          >
            {t('cancel')}
          </Button>
          <Button color="red" onClick={handleBlockIp} disabled={isBlocking}>
            {t('confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unblock confirm dialog */}
      <Dialog open={!!unblockTarget} onClose={() => setUnblockTarget(null)}>
        <DialogTitle>{t('unblockConfirmTitle')}</DialogTitle>
        <DialogDescription>
          {t('unblockConfirmDescription', {
            ip: unblockTarget?.ipAddress ?? '',
          })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reason')}</label>
            <Textarea
              value={unblockReason}
              onChange={(e) => setUnblockReason(e.target.value)}
              placeholder={t('unblockReasonPlaceholder')}
              rows={3}
            />
            {unblockError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {unblockError}
              </div>
            )}
          </div>
        </DialogBody>
        <DialogActions>
          <Button
            plain
            onClick={() => setUnblockTarget(null)}
            disabled={isUnblocking}
          >
            {t('cancel')}
          </Button>
          <Button
            color="brand-green"
            onClick={handleUnblock}
            disabled={isUnblocking}
          >
            {t('confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* History dialog */}
      <Dialog open={!!historyIp} onClose={() => setHistoryIp(null)}>
        <DialogTitle>{t('historyTitle', { ip: historyIp ?? '' })}</DialogTitle>
        <DialogBody>
          {historyEntries.length === 0 ? (
            <Text className="text-sm text-zinc-500">{t('historyEmpty')}</Text>
          ) : (
            <div className="space-y-3">
              {historyEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="border-b border-zinc-100 pb-2 last:border-0 dark:border-zinc-800"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-zinc-500">
                      {formatDateTime(entry.createdAt)}
                    </span>
                    <span
                      className={`text-sm font-medium ${
                        entry.status === 'blocked'
                          ? 'text-red-600 dark:text-red-400'
                          : 'text-green-600 dark:text-green-400'
                      }`}
                    >
                      {entry.status === 'blocked'
                        ? t('statusBlocked')
                        : t('statusUnblocked')}
                    </span>
                    <span className="text-sm text-zinc-500">
                      {t('changedBy', {
                        name: User.formatFullName(
                          entry.statusChangedBy.firstName,
                          entry.statusChangedBy.lastName,
                          entry.statusChangedBy.middleName
                        ),
                      })}
                    </span>
                  </div>
                  {entry.reason && (
                    <div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {entry.reason}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setHistoryIp(null)}>
            {t('cancel')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
