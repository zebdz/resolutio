'use client';

import { useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Input } from '@/src/web/components/catalyst/input';
import {
  resetLimiterAction,
  clearBlockedKeysAction,
  searchRateLimitEntriesAction,
  resetRateLimitKeysAction,
  lockRateLimitKeyAction,
  unlockRateLimitKeyAction,
  type LimiterOverview,
  type EnrichedEntry,
} from '@/src/web/actions/superadmin/rateLimitAdmin';
import { ConfirmDialog } from './ConfirmDialog';
import { User } from '@/domain/user/User';

interface LimiterCardProps {
  overview: LimiterOverview;
  onMutate: () => void;
}

function formatWindow(
  ms: number,
  t: (key: string, values?: Record<string, number>) => string
): string {
  if (ms >= 3_600_000) {
    return t('windowHours', { count: ms / 3_600_000 });
  }

  if (ms >= 60_000) {
    return t('windowMinutes', { count: ms / 60_000 });
  }

  return t('windowSeconds', { count: ms / 1_000 });
}

type FilterType = 'all' | 'locked' | 'unlocked';

export function LimiterCard({ overview, onMutate }: LimiterCardProps) {
  const t = useTranslations('superadmin.rateLimits');
  const tLabels = useTranslations('superadmin.rateLimits.labels');
  const [expanded, setExpanded] = useState(false);
  const [query, setQuery] = useState('');
  const [entries, setEntries] = useState<EnrichedEntry[]>([]);
  const [filter, setFilter] = useState<FilterType>('all');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    description: string;
    action: () => Promise<void>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [searchTimer, setSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const label = overview.label;

  const doSearch = useCallback(
    async (q: string) => {
      if (q.length < 3) {
        setEntries([]);

        return;
      }

      setIsLoading(true);
      const result = await searchRateLimitEntriesAction({
        label: overview.label,
        query: q,
      });

      if (result.success) {
        setEntries(result.data);
      }

      setIsLoading(false);
    },
    [overview.label]
  );

  const handleSearchChange = (value: string) => {
    setQuery(value);

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const timer = setTimeout(() => doSearch(value), 500);
    setSearchTimer(timer);
  };

  const handleResetLimiter = () => {
    setConfirmAction({
      title: t('resetLimiterConfirmTitle', { name: tLabels(label) }),
      description: t('resetLimiterConfirmDescription', {
        name: tLabels(label),
      }),
      action: async () => {
        await resetLimiterAction({ label: overview.label });
        setEntries([]);
        setSelected(new Set());
        onMutate();
      },
    });
  };

  const handleClearLocks = () => {
    setConfirmAction({
      title: t('clearLocksConfirmTitle'),
      description: t('clearLocksConfirmDescription', {
        name: tLabels(label),
      }),
      action: async () => {
        await clearBlockedKeysAction({ label: overview.label });

        if (query.length >= 3) {
          await doSearch(query);
        }

        onMutate();
      },
    });
  };

  const handleLockKey = (key: string) => {
    setConfirmAction({
      title: t('lockKeyConfirmTitle'),
      description: t('lockKeyConfirmDescription'),
      action: async () => {
        await lockRateLimitKeyAction({ label: overview.label, key });

        if (query.length >= 3) {
          await doSearch(query);
        }

        onMutate();
      },
    });
  };

  const handleUnlockKey = (key: string) => {
    setConfirmAction({
      title: t('unlockKeyConfirmTitle'),
      description: t('unlockKeyConfirmDescription'),
      action: async () => {
        await unlockRateLimitKeyAction({ label: overview.label, key });

        if (query.length >= 3) {
          await doSearch(query);
        }

        onMutate();
      },
    });
  };

  const handleResetSelected = async () => {
    const keys = Array.from(selected);
    await resetRateLimitKeysAction({ label: overview.label, keys });
    setSelected(new Set());

    if (query.length >= 3) {
      await doSearch(query);
    }

    onMutate();
  };

  const handleConfirmAction = async () => {
    if (!confirmAction) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      await confirmAction.action();
      setConfirmAction(null);
    } catch {
      setError('Action failed');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleSelect = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);

      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }

      return next;
    });
  };

  const filteredEntries = entries.filter((e) => {
    if (filter === 'locked') {
      return e.blocked;
    }

    if (filter === 'unlocked') {
      return !e.blocked;
    }

    return true;
  });

  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-700">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between p-4 text-left"
      >
        <div>
          <Heading level={3} className="text-base font-semibold">
            {tLabels(label)}
          </Heading>
          <Text className="text-sm text-zinc-500">
            {t('config', {
              maxRequests: overview.maxRequests,
              window: formatWindow(overview.windowMs, t),
            })}
          </Text>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <span>{t('entryCount', { count: overview.entryCount })}</span>
          {overview.blockedCount > 0 && (
            <span className="text-red-600 dark:text-red-400">
              {t('blockedCount', { count: overview.blockedCount })}
            </span>
          )}
          <span className="text-zinc-400">{expanded ? '▲' : '▼'}</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-zinc-200 p-4 dark:border-zinc-700">
          <div className="mb-4 flex flex-wrap gap-2">
            <Button plain onClick={handleClearLocks}>
              {t('clearLocks')}
            </Button>
            <Button plain onClick={handleResetLimiter}>
              {t('resetLimiter')}
            </Button>
          </div>

          <Input
            value={query}
            onChange={(e) => handleSearchChange(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="mb-3"
          />

          {query.length > 0 && query.length < 3 && (
            <Text className="mb-3 text-sm text-zinc-500">
              {t('searchMinChars')}
            </Text>
          )}

          {query.length >= 3 && (
            <>
              <div className="mb-3 flex gap-2">
                {(['all', 'locked', 'unlocked'] as const).map((f) => (
                  <Button
                    key={f}
                    {...(filter !== f
                      ? { plain: true }
                      : { color: 'dark/zinc' as const })}
                    onClick={() => setFilter(f)}
                    className="text-xs"
                  >
                    {t(
                      f === 'all'
                        ? 'filterAll'
                        : f === 'locked'
                          ? 'filterLocked'
                          : 'filterUnlocked'
                    )}
                  </Button>
                ))}
              </div>

              {isLoading ? (
                <Text className="text-sm text-zinc-500">...</Text>
              ) : filteredEntries.length === 0 ? (
                <Text className="text-sm text-zinc-500">{t('noResults')}</Text>
              ) : (
                <div className="space-y-1">
                  <div className="hidden grid-cols-[auto_1fr_auto_auto_auto_auto] items-center gap-2 text-xs font-medium text-zinc-500 sm:grid">
                    <span className="w-5" />
                    <span>{t('key')}</span>
                    <span>{t('hits')}</span>
                    <span>{t('remaining')}</span>
                    <span>{t('status')}</span>
                    <span />
                  </div>

                  {filteredEntries.map((entry) => (
                    <div
                      key={entry.key}
                      className="grid grid-cols-1 items-center gap-2 rounded border border-zinc-100 p-2 text-sm dark:border-zinc-800 sm:grid-cols-[auto_1fr_auto_auto_auto_auto]"
                    >
                      <input
                        type="checkbox"
                        checked={selected.has(entry.key)}
                        onChange={() => toggleSelect(entry.key)}
                        className="h-4 w-4"
                      />
                      <div className="min-w-0">
                        <div className="truncate font-mono text-xs">
                          {entry.key}
                        </div>
                        {entry.resolvedUser && (
                          <div className="text-xs text-zinc-500">
                            {t('resolvedUser', {
                              name: User.formatFullName(
                                entry.resolvedUser.firstName,
                                entry.resolvedUser.lastName,
                                entry.resolvedUser.middleName
                              ),
                              phone: entry.resolvedUser.phoneNumber,
                            })}
                          </div>
                        )}
                      </div>
                      <span className="font-mono text-xs">
                        {entry.count}/{overview.maxRequests}
                      </span>
                      <span className="font-mono text-xs">
                        {entry.remaining}
                      </span>
                      <span
                        className={`text-xs font-medium ${entry.blocked ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}
                      >
                        {entry.blocked ? t('locked') : t('ok')}
                      </span>
                      {entry.blocked ? (
                        <Button
                          plain
                          onClick={() => handleUnlockKey(entry.key)}
                          className="text-xs"
                        >
                          {t('unlockKey')}
                        </Button>
                      ) : (
                        <Button
                          plain
                          onClick={() => handleLockKey(entry.key)}
                          className="text-xs"
                        >
                          {t('lockKey')}
                        </Button>
                      )}
                    </div>
                  ))}

                  {selected.size > 0 && (
                    <div className="mt-2">
                      <Button onClick={handleResetSelected}>
                        {t('resetSelected', { count: selected.size })}
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        title={confirmAction?.title ?? ''}
        description={confirmAction?.description ?? ''}
        onConfirm={handleConfirmAction}
        isLoading={isLoading}
        error={error}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
      />
    </div>
  );
}
