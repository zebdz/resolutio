'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import { Text } from '@/app/components/catalyst/text';
import { Textarea } from '@/app/components/catalyst/textarea';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { Input } from '@/app/components/catalyst/input';
import {
  getSuspiciousActivitySummaryAction,
  getSuspiciousActivityForKeyAction,
  blockUserAction,
  unblockUserAction,
  type SuspiciousKeySummary,
} from '@/web/actions/suspiciousActivity';
import { blockIpAction } from '@/web/actions/ipBlockAdmin';
import { User } from '@/domain/user/User';

const PAGE_SIZE = 20;

const NON_IP_PREFIXES = [
  'session:',
  'mw-session:',
  'user:',
  'login:',
  'register:',
];

function isIpLikeKey(key: string): boolean {
  return !NON_IP_PREFIXES.some((prefix) => key.startsWith(prefix));
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString();
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString();
}

export function SuspiciousActivityPanel() {
  const t = useTranslations('superadmin.suspiciousActivity');
  const tLabels = useTranslations('superadmin.rateLimits.labels');
  const [items, setItems] = useState<SuspiciousKeySummary[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const pageRef = useRef(1);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; createdAt: Date }>>(
    []
  );
  const [blockTarget, setBlockTarget] = useState<{
    userId: string;
    name: string;
    reason: string;
  } | null>(null);
  const [unblockTarget, setUnblockTarget] = useState<{
    userId: string;
    name: string;
    reason: string;
  } | null>(null);
  const [blockIpTarget, setBlockIpTarget] = useState<{
    ip: string;
    reason: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minBlocked, setMinBlocked] = useState('');
  const [maxBlocked, setMaxBlocked] = useState('');

  const fetchSummary = useCallback(
    async (
      p: number,
      filters?: {
        search?: string;
        dateFrom?: string;
        dateTo?: string;
        minBlocked?: string;
        maxBlocked?: string;
      }
    ) => {
      const result = await getSuspiciousActivitySummaryAction({
        page: p,
        pageSize: PAGE_SIZE,
        search: filters?.search || undefined,
        dateFrom: filters?.dateFrom || undefined,
        dateTo: filters?.dateTo || undefined,
        minBlocked: filters?.minBlocked
          ? Number(filters.minBlocked)
          : undefined,
        maxBlocked: filters?.maxBlocked
          ? Number(filters.maxBlocked)
          : undefined,
      });

      if (result.success) {
        if (p === 1) {
          setItems(result.data.items);
        } else {
          setItems((prev) => [...prev, ...result.data.items]);
        }

        setTotalCount(result.data.totalCount);
      }
    },
    []
  );

  // Initial fetch + re-fetch when filters change
  useEffect(() => {
    let cancelled = false;
    pageRef.current = 1;

    getSuspiciousActivitySummaryAction({
      page: 1,
      pageSize: PAGE_SIZE,
      search: search || undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      minBlocked: minBlocked ? Number(minBlocked) : undefined,
      maxBlocked: maxBlocked ? Number(maxBlocked) : undefined,
    }).then((result) => {
      if (!cancelled && result.success) {
        setItems(result.data.items);
        setTotalCount(result.data.totalCount);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [search, dateFrom, dateTo, minBlocked, maxBlocked]);

  const handleLoadMore = () => {
    const next = pageRef.current + 1;
    pageRef.current = next;
    fetchSummary(next, { search, dateFrom, dateTo, minBlocked, maxBlocked });
  };

  const handleExpandKey = async (key: string) => {
    if (expandedKey === key) {
      setExpandedKey(null);

      return;
    }

    setExpandedKey(key);
    const result = await getSuspiciousActivityForKeyAction({ key });

    if (result.success) {
      setEvents(result.data.events);
    }
  };

  const handleBlockUser = (item: SuspiciousKeySummary) => {
    if (!item.userId || !item.resolvedUser) {
      return;
    }

    const name = User.formatFullName(
      item.resolvedUser.firstName,
      item.resolvedUser.lastName,
      item.resolvedUser.middleName
    );
    const limiterLabel = tLabels(item.limiterLabel);
    const reason = t('autoReason', {
      count: item.totalEvents,
      limiter: limiterLabel,
      first: formatDate(item.firstEventAt),
      last: formatDate(item.lastEventAt),
    });
    setBlockTarget({ userId: item.userId, name, reason });
  };

  const handleConfirmBlock = async () => {
    if (!blockTarget) {
      return;
    }

    if (!blockTarget.reason.trim()) {
      setError(t('reasonRequired'));

      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await blockUserAction({
      userId: blockTarget.userId,
      reason: blockTarget.reason,
    });

    if (result.success) {
      console.log(
        `[SuspiciousActivity] Blocked user ${blockTarget.userId}: ${blockTarget.reason}`
      );
      setBlockTarget(null);
      await fetchSummary(1, {
        search,
        dateFrom,
        dateTo,
        minBlocked,
        maxBlocked,
      });
      pageRef.current = 1;
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleUnblockUser = (item: SuspiciousKeySummary) => {
    if (!item.userId || !item.resolvedUser) {
      return;
    }

    const name = User.formatFullName(
      item.resolvedUser.firstName,
      item.resolvedUser.lastName,
      item.resolvedUser.middleName
    );
    setUnblockTarget({ userId: item.userId, name, reason: '' });
  };

  const handleConfirmUnblock = async () => {
    if (!unblockTarget) {
      return;
    }

    if (!unblockTarget.reason.trim()) {
      setError(t('reasonRequired'));

      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await unblockUserAction({
      userId: unblockTarget.userId,
      reason: unblockTarget.reason,
    });

    if (result.success) {
      console.log(
        `[SuspiciousActivity] Unblocked user ${unblockTarget.userId}`
      );
      setUnblockTarget(null);
      await fetchSummary(1, {
        search,
        dateFrom,
        dateTo,
        minBlocked,
        maxBlocked,
      });
      pageRef.current = 1;
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleBlockIp = (item: SuspiciousKeySummary) => {
    // Extract IP from key (IP-keyed entries have format like "ip:1.2.3.4" or just the IP)
    const ip = item.key.startsWith('ip:') ? item.key.slice(3) : item.key;
    const limiterLabel = tLabels(item.limiterLabel);
    const tBlockedIps = t;
    const reason = tBlockedIps('autoReason', {
      count: item.totalEvents,
      limiter: limiterLabel,
      first: formatDate(item.firstEventAt),
      last: formatDate(item.lastEventAt),
    });
    setBlockIpTarget({ ip, reason });
  };

  const handleConfirmBlockIp = async () => {
    if (!blockIpTarget) {
      return;
    }

    if (!blockIpTarget.reason.trim()) {
      setError(t('reasonRequired'));

      return;
    }

    setIsLoading(true);
    setError(null);
    const result = await blockIpAction({
      ipAddress: blockIpTarget.ip,
      reason: blockIpTarget.reason,
    });

    if (result.success) {
      setBlockIpTarget(null);
      await fetchSummary(1, {
        search,
        dateFrom,
        dateTo,
        minBlocked,
        maxBlocked,
      });
      pageRef.current = 1;
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-2">
      {/* Filters */}
      <div className="flex flex-wrap gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700">
        <Input
          className="min-w-[12rem] flex-1"
          placeholder={t('searchPlaceholder')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('dateFrom')}</label>
          <input
            type="date"
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('dateTo')}</label>
          <input
            type="date"
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('minBlocked')}</label>
          <input
            type="number"
            min={1}
            className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={minBlocked}
            onChange={(e) => setMinBlocked(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('maxBlocked')}</label>
          <input
            type="number"
            min={1}
            className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={maxBlocked}
            onChange={(e) => setMaxBlocked(e.target.value)}
          />
        </div>
      </div>

      {items.length === 0 && (
        <Text className="text-zinc-500">{t('noEvents')}</Text>
      )}

      {/* Header - hidden on mobile */}
      {items.length > 0 && (
        <div className="hidden grid-cols-[1fr_10rem_5rem_5rem_5rem] gap-4 px-4 text-xs font-medium text-zinc-500 sm:grid">
          <span>{t('key')}</span>
          <span>{t('limiter')}</span>
          <span>{t('timesBlocked')}</span>
          <span>{t('firstEvent')}</span>
          <span>{t('lastEvent')}</span>
        </div>
      )}

      {items.map((item) => (
        <div
          key={`${item.key}-${item.limiterLabel}`}
          className="rounded-lg border border-zinc-200 dark:border-zinc-700"
        >
          <button
            type="button"
            onClick={() => handleExpandKey(item.key)}
            className="w-full cursor-pointer p-3 text-left"
          >
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_10rem_5rem_5rem_5rem] sm:items-center sm:gap-4">
              <div className="min-w-0">
                <div className="truncate font-mono text-sm">{item.key}</div>
                {item.resolvedUser && (
                  <div className="text-xs text-zinc-500">
                    {User.formatFullName(
                      item.resolvedUser.firstName,
                      item.resolvedUser.lastName,
                      item.resolvedUser.middleName
                    )}{' '}
                    ({item.resolvedUser.phoneNumber})
                  </div>
                )}
              </div>
              <span className="break-words text-xs text-zinc-500">
                {tLabels(item.limiterLabel)}
              </span>
              <span className="font-mono text-sm font-medium">
                {item.totalEvents}
              </span>
              <span className="text-xs text-zinc-500">
                {formatDate(item.firstEventAt)}
              </span>
              <span className="text-xs text-zinc-500">
                {formatDate(item.lastEventAt)}
              </span>
            </div>

            {item.userId && (
              <div className="mt-1 flex items-center gap-2">
                {item.blockStatus?.blocked ? (
                  <span className="text-xs font-medium text-red-600 dark:text-red-400">
                    {t('userBlocked')}
                  </span>
                ) : (
                  <span className="text-xs font-medium text-green-600 dark:text-green-400">
                    {t('userActive')}
                  </span>
                )}
              </div>
            )}
          </button>

          {expandedKey === item.key && (
            <div className="border-t border-zinc-200 p-3 dark:border-zinc-700">
              {item.userId && item.resolvedUser && (
                <div className="mb-3 flex gap-2">
                  {item.blockStatus?.blocked ? (
                    <Button
                      color="brand-green"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleUnblockUser(item);
                      }}
                      className="text-xs"
                    >
                      {t('unblockUser')}
                    </Button>
                  ) : (
                    <Button
                      color="red"
                      onClick={(e: React.MouseEvent) => {
                        e.stopPropagation();
                        handleBlockUser(item);
                      }}
                      className="text-xs"
                    >
                      {t('blockUser')}
                    </Button>
                  )}
                </div>
              )}

              {!item.userId && isIpLikeKey(item.key) && (
                <div className="mb-3 flex gap-2">
                  <Button
                    color="red"
                    onClick={(e: React.MouseEvent) => {
                      e.stopPropagation();
                      handleBlockIp(item);
                    }}
                    className="text-xs"
                  >
                    {t('blockIp')}
                  </Button>
                </div>
              )}

              <div className="space-y-1">
                <Text className="text-xs font-medium text-zinc-500">
                  {t('events')}
                </Text>
                {events.map((event) => (
                  <div
                    key={event.id}
                    className="text-xs text-zinc-600 dark:text-zinc-400"
                  >
                    {formatDateTime(event.createdAt)}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}

      {items.length < totalCount && (
        <div className="text-center">
          <Button plain onClick={handleLoadMore}>
            {t('loadMore')}
          </Button>
        </div>
      )}

      {/* Block dialog with editable reason */}
      <Dialog open={!!blockTarget} onClose={() => setBlockTarget(null)}>
        <DialogTitle>{t('blockConfirmTitle')}</DialogTitle>
        <DialogDescription>
          {t('blockConfirmDescription', { name: blockTarget?.name ?? '' })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reasonLabel')}</label>
            <Textarea
              value={blockTarget?.reason ?? ''}
              onChange={(e) =>
                setBlockTarget((prev) =>
                  prev ? { ...prev, reason: e.target.value } : null
                )
              }
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
            onClick={() => setBlockTarget(null)}
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button color="red" onClick={handleConfirmBlock} disabled={isLoading}>
            {t('confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Block IP dialog */}
      <Dialog open={!!blockIpTarget} onClose={() => setBlockIpTarget(null)}>
        <DialogTitle>{t('blockIpConfirmTitle')}</DialogTitle>
        <DialogDescription>
          {t('blockIpConfirmDescription', { ip: blockIpTarget?.ip ?? '' })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium">
                {t('ipAddressLabel')}
              </label>
              <Input
                value={blockIpTarget?.ip ?? ''}
                onChange={(e) =>
                  setBlockIpTarget((prev) =>
                    prev ? { ...prev, ip: e.target.value } : null
                  )
                }
              />
            </div>
            <div>
              <label className="text-sm font-medium">{t('reasonLabel')}</label>
              <Textarea
                value={blockIpTarget?.reason ?? ''}
                onChange={(e) =>
                  setBlockIpTarget((prev) =>
                    prev ? { ...prev, reason: e.target.value } : null
                  )
                }
                rows={3}
              />
            </div>
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
            onClick={() => setBlockIpTarget(null)}
            disabled={isLoading}
          >
            {t('cancel')}
          </Button>
          <Button
            color="red"
            onClick={handleConfirmBlockIp}
            disabled={isLoading}
          >
            {t('confirm')}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Unblock dialog */}
      <Dialog open={!!unblockTarget} onClose={() => setUnblockTarget(null)}>
        <DialogTitle>{t('unblockConfirmTitle')}</DialogTitle>
        <DialogDescription>
          {t('unblockConfirmDescription', {
            name: unblockTarget?.name ?? '',
          })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reasonLabel')}</label>
            <Textarea
              value={unblockTarget?.reason ?? ''}
              onChange={(e) =>
                setUnblockTarget((prev) =>
                  prev ? { ...prev, reason: e.target.value } : null
                )
              }
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
            onClick={handleConfirmUnblock}
            disabled={isLoading}
          >
            {t('confirm')}
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
