'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Input } from '@/src/web/components/catalyst/input';
import {
  getSuspiciousActivityForKeyAction,
  blockUserAction,
  unblockUserAction,
} from '@/src/web/actions/superadmin/suspiciousActivity';
import { blockIpAction } from '@/src/web/actions/superadmin/ipBlockAdmin';
import { User } from '@/domain/user/User';

export interface SerializedSuspiciousKeySummary {
  key: string;
  userId: string | null;
  limiterLabel: string;
  totalEvents: number;
  maxRequests: number | null;
  windowMs: number | null;
  firstEventAt: string;
  lastEventAt: string;
  resolvedUser?: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
    phoneNumber: string;
  };
  blockStatus?: {
    blocked: boolean;
    reason?: string;
    blockedAt?: string;
  } | null;
}

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

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString();
}

function formatDateTime(date: Date): string {
  return new Date(date).toLocaleString();
}

function formatWindow(
  windowMs: number,
  t: ReturnType<typeof useTranslations>
): string {
  const seconds = Math.round(windowMs / 1000);

  if (seconds < 60) {
    return t('windowSeconds', { count: seconds });
  }

  const minutes = Math.round(seconds / 60);

  if (minutes < 60) {
    return t('windowMinutes', { count: minutes });
  }

  const hours = Math.round(minutes / 60);

  return t('windowHours', { count: hours });
}

interface SuspiciousActivityFilters {
  search: string;
  dateFrom: string;
  dateTo: string;
  minBlocked: string;
  maxBlocked: string;
}

interface SuspiciousActivityPanelProps {
  items: SerializedSuspiciousKeySummary[];
  totalPages: number;
  currentPage: number;
  filters: SuspiciousActivityFilters;
}

export function SuspiciousActivityPanel({
  items,
  totalPages,
  currentPage,
  filters,
}: SuspiciousActivityPanelProps) {
  const t = useTranslations('superadmin.suspiciousActivity');
  const tLabels = useTranslations('superadmin.rateLimits.labels');
  const tRateLimits = useTranslations('superadmin.rateLimits');
  const tPagination = useTranslations('common.pagination');
  const router = useRouter();
  const pathname = usePathname();

  // Local state for debounced inputs
  const [searchValue, setSearchValue] = useState(filters.search);
  const [searchTimer, setSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [minBlockedValue, setMinBlockedValue] = useState(filters.minBlocked);
  const [minBlockedTimer, setMinBlockedTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);
  const [maxBlockedValue, setMaxBlockedValue] = useState(filters.maxBlocked);
  const [maxBlockedTimer, setMaxBlockedTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Expand / events state
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [events, setEvents] = useState<Array<{ id: string; createdAt: Date }>>(
    []
  );

  // Dialog state
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
  const [dialogError, setDialogError] = useState<string | null>(null);

  // Build URL with updated params
  const buildUrl = useCallback(
    (updates: Partial<SuspiciousActivityFilters> & { page?: number }) => {
      const params = new URLSearchParams();
      const merged = { ...filters, ...updates };

      if (merged.search) {
        params.set('search', merged.search);
      }

      if (merged.dateFrom) {
        params.set('dateFrom', merged.dateFrom);
      }

      if (merged.dateTo) {
        params.set('dateTo', merged.dateTo);
      }

      if (merged.minBlocked) {
        params.set('minBlocked', merged.minBlocked);
      }

      if (merged.maxBlocked) {
        params.set('maxBlocked', merged.maxBlocked);
      }

      const page = updates.page ?? 1;

      if (page > 1) {
        params.set('page', String(page));
      }

      const qs = params.toString();

      return qs ? `${pathname}?${qs}` : pathname;
    },
    [filters, pathname]
  );

  const navigateWithFilter = useCallback(
    (updates: Partial<SuspiciousActivityFilters>) => {
      router.push(buildUrl({ ...updates, page: 1 }));
    },
    [buildUrl, router]
  );

  // Debounced search handler
  const handleSearchChange = (value: string) => {
    setSearchValue(value);

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const timer = setTimeout(() => {
      navigateWithFilter({ search: value });
    }, 300);
    setSearchTimer(timer);
  };

  // Debounced minBlocked handler
  const handleMinBlockedChange = (value: string) => {
    setMinBlockedValue(value);

    if (minBlockedTimer) {
      clearTimeout(minBlockedTimer);
    }

    const timer = setTimeout(() => {
      navigateWithFilter({ minBlocked: value });
    }, 300);
    setMinBlockedTimer(timer);
  };

  // Debounced maxBlocked handler
  const handleMaxBlockedChange = (value: string) => {
    setMaxBlockedValue(value);

    if (maxBlockedTimer) {
      clearTimeout(maxBlockedTimer);
    }

    const timer = setTimeout(() => {
      navigateWithFilter({ maxBlocked: value });
    }, 300);
    setMaxBlockedTimer(timer);
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

  const handleBlockUser = (item: SerializedSuspiciousKeySummary) => {
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
    setDialogError(null);
    setBlockTarget({ userId: item.userId, name, reason });
  };

  const handleConfirmBlock = async () => {
    if (!blockTarget) {
      return;
    }

    if (!blockTarget.reason.trim()) {
      setDialogError(t('reasonRequired'));

      return;
    }

    setIsLoading(true);
    setDialogError(null);
    const result = await blockUserAction({
      userId: blockTarget.userId,
      reason: blockTarget.reason,
    });

    if (result.success) {
      console.log(
        `[SuspiciousActivity] Blocked user ${blockTarget.userId}: ${blockTarget.reason}`
      );
      setDialogError(null);
      setBlockTarget(null);
      router.refresh();
    } else if (result.fieldErrors?.reason) {
      setDialogError(result.fieldErrors.reason[0]);
    } else {
      setDialogError(result.error);
    }

    setIsLoading(false);
  };

  const handleUnblockUser = (item: SerializedSuspiciousKeySummary) => {
    if (!item.userId || !item.resolvedUser) {
      return;
    }

    const name = User.formatFullName(
      item.resolvedUser.firstName,
      item.resolvedUser.lastName,
      item.resolvedUser.middleName
    );
    setDialogError(null);
    setUnblockTarget({ userId: item.userId, name, reason: '' });
  };

  const handleConfirmUnblock = async () => {
    if (!unblockTarget) {
      return;
    }

    if (!unblockTarget.reason.trim()) {
      setDialogError(t('reasonRequired'));

      return;
    }

    setIsLoading(true);
    setDialogError(null);
    const result = await unblockUserAction({
      userId: unblockTarget.userId,
      reason: unblockTarget.reason,
    });

    if (result.success) {
      console.log(
        `[SuspiciousActivity] Unblocked user ${unblockTarget.userId}`
      );
      setDialogError(null);
      setUnblockTarget(null);
      router.refresh();
    } else if (result.fieldErrors?.reason) {
      setDialogError(result.fieldErrors.reason[0]);
    } else {
      setDialogError(result.error);
    }

    setIsLoading(false);
  };

  const handleBlockIp = (item: SerializedSuspiciousKeySummary) => {
    // Extract IP from key (IP-keyed entries have format like "ip:1.2.3.4" or just the IP)
    const ip = item.key.startsWith('ip:') ? item.key.slice(3) : item.key;
    const limiterLabel = tLabels(item.limiterLabel);
    const reason = t('autoReason', {
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
      router.refresh();
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
          value={searchValue}
          onChange={(e) => handleSearchChange(e.target.value)}
        />
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('dateFrom')}</label>
          <input
            type="date"
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={filters.dateFrom}
            onChange={(e) => navigateWithFilter({ dateFrom: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('dateTo')}</label>
          <input
            type="date"
            className="rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={filters.dateTo}
            onChange={(e) => navigateWithFilter({ dateTo: e.target.value })}
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('minBlocked')}</label>
          <input
            type="number"
            min={1}
            className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={minBlockedValue}
            onChange={(e) => handleMinBlockedChange(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-xs text-zinc-500">{t('maxBlocked')}</label>
          <input
            type="number"
            min={1}
            className="w-16 rounded border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-600"
            value={maxBlockedValue}
            onChange={(e) => handleMaxBlockedChange(e.target.value)}
          />
        </div>

        {/* Clear filters */}
        {(filters.search ||
          filters.dateFrom ||
          filters.dateTo ||
          filters.minBlocked ||
          filters.maxBlocked) && (
          <Button
            plain
            onClick={() => {
              setSearchValue('');
              setMinBlockedValue('');
              setMaxBlockedValue('');
              router.push(pathname);
            }}
            className="text-sm"
          >
            {t('clearFilters')}
          </Button>
        )}
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
              <span className="font-mono text-sm">
                <span className="font-medium">{item.totalEvents}</span>
                {item.maxRequests !== null && item.windowMs !== null && (
                  <span className="ml-1 text-xs text-zinc-500">
                    {t('limitInfo', {
                      max: item.maxRequests,
                      window: formatWindow(item.windowMs, tRateLimits),
                    })}
                  </span>
                )}
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

      {/* Pagination */}
      {totalPages >= 1 && (
        <div className="flex items-center justify-between">
          <Button
            plain
            disabled={currentPage <= 1}
            onClick={() => router.push(buildUrl({ page: currentPage - 1 }))}
          >
            {tPagination('previous')}
          </Button>
          <Text className="text-sm text-zinc-500">
            {tPagination('page', { page: currentPage, totalPages })}
          </Text>
          <Button
            plain
            disabled={currentPage >= totalPages}
            onClick={() => router.push(buildUrl({ page: currentPage + 1 }))}
          >
            {tPagination('next')}
          </Button>
        </div>
      )}

      {/* Block dialog with editable reason */}
      <Dialog
        open={!!blockTarget}
        onClose={() => {
          setBlockTarget(null);
          setDialogError(null);
        }}
      >
        <DialogTitle>{t('blockConfirmTitle')}</DialogTitle>
        <DialogDescription>
          {t('blockConfirmDescription', { name: blockTarget?.name ?? '' })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-2">
            <label className="text-sm font-medium">{t('reasonLabel')}</label>
            <Textarea
              value={blockTarget?.reason ?? ''}
              invalid={!!dialogError}
              onChange={(e) => {
                setBlockTarget((prev) =>
                  prev ? { ...prev, reason: e.target.value } : null
                );
                setDialogError(null);
              }}
              rows={3}
            />
            {dialogError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {dialogError}
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
      <Dialog
        open={!!unblockTarget}
        onClose={() => {
          setUnblockTarget(null);
          setDialogError(null);
        }}
      >
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
              invalid={!!dialogError}
              onChange={(e) => {
                setUnblockTarget((prev) =>
                  prev ? { ...prev, reason: e.target.value } : null
                );
                setDialogError(null);
              }}
              rows={3}
            />
            {dialogError && (
              <div className="text-sm text-red-600 dark:text-red-400">
                {dialogError}
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
