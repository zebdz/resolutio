'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import {
  getRateLimitMonitorSnapshotAction,
  getKeyLimiterDetailsAction,
  type MonitorEntry,
  type KeyLimiterDetail,
} from '@/web/actions/rateLimitMonitor';
import { KeyDetailView } from './KeyDetailView';

const POLL_INTERVAL_MS = 2000;

const LIMITER_LABELS = [
  'middlewareSession',
  'middlewareIp',
  'serverActionSession',
  'serverActionIp',
  'phoneSearch',
  'login',
  'registrationIp',
  'registrationDevice',
] as const;

const LIMITER_DISPLAY: Record<string, string> = {
  middlewareSession: 'MW (Session)',
  middlewareIp: 'MW (IP)',
  serverActionSession: 'SA (Session)',
  serverActionIp: 'SA (IP)',
  phoneSearch: 'Phone Search',
  login: 'Login',
  registrationIp: 'Reg (IP)',
  registrationDevice: 'Reg (Device)',
};

export function MonitorPanel() {
  const t = useTranslations('superadmin.monitor');
  const [entries, setEntries] = useState<MonitorEntry[]>([]);
  const [paused, setPaused] = useState(false);
  const [query, setQuery] = useState('');
  const [labelFilter, setLabelFilter] = useState<string | undefined>();
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [keyDetails, setKeyDetails] = useState<KeyLimiterDetail[] | null>(null);
  const generationRef = useRef(0);
  const dismissedKeyRef = useRef<string | null>(null);
  const selectedKeyRef = useRef<string | null>(null);

  const fetchSnapshot = useCallback(async (): Promise<
    MonitorEntry[] | null
  > => {
    const gen = ++generationRef.current;
    const result = await getRateLimitMonitorSnapshotAction({
      query: query.length >= 3 ? query : undefined,
      label: labelFilter,
    });

    // Discard stale response
    if (gen !== generationRef.current) {
      return null;
    }

    if (result.success) {
      setEntries(result.data);

      return result.data;
    }

    return null;
  }, [query, labelFilter]);

  const fetchKeyDetails = useCallback(async (key: string) => {
    const result = await getKeyLimiterDetailsAction({ key });

    if (result.success) {
      setKeyDetails(result.data);
    }
  }, []);

  // Polling (snapshot + key details)
  useEffect(() => {
    if (paused) {
      return;
    }

    const poll = () => {
      fetchSnapshot().then((newEntries) => {
        if (!newEntries) {
          return;
        }

        // Auto-select when only 1 unique key in results (skip if user dismissed it)
        const uniqueKeys = new Set(newEntries.map((e) => e.key));

        if (uniqueKeys.size === 1) {
          const key = [...uniqueKeys][0];

          if (key !== dismissedKeyRef.current) {
            selectedKeyRef.current = key;
            setSelectedKey(key);
          }
        }
      });

      // selectedKey is captured via ref to avoid re-creating interval
      if (selectedKeyRef.current) {
        fetchKeyDetails(selectedKeyRef.current);
      }
    };

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [fetchSnapshot, fetchKeyDetails, paused]);

  const handleKeyClick = (key: string) => {
    dismissedKeyRef.current = null;
    const next = selectedKey === key ? null : key;
    selectedKeyRef.current = next;
    setSelectedKey(next);

    if (!next) {
      setKeyDetails(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-wrap items-center gap-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t('searchPlaceholder')}
          className="w-64 rounded-md border border-zinc-300 px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
        />
        <Button
          color={paused ? 'green' : 'amber'}
          onClick={() => setPaused(!paused)}
          className="text-sm"
        >
          {paused ? t('resume') : t('pause')}
        </Button>
      </div>

      {/* Limiter label filter */}
      <div className="flex flex-wrap gap-1">
        <Button
          color={!labelFilter ? 'dark/zinc' : 'zinc'}
          onClick={() => setLabelFilter(undefined)}
          className="text-xs"
        >
          {t('all')}
        </Button>
        {LIMITER_LABELS.map((label) => (
          <Button
            key={label}
            color={labelFilter === label ? 'dark/zinc' : 'zinc'}
            onClick={() =>
              setLabelFilter(labelFilter === label ? undefined : label)
            }
            className="text-xs"
          >
            {LIMITER_DISPLAY[label]}
          </Button>
        ))}
      </div>

      {/* Key detail view */}
      {selectedKey && keyDetails && (
        <KeyDetailView
          keyName={selectedKey}
          details={keyDetails}
          onRefresh={() => {
            fetchKeyDetails(selectedKey);
            fetchSnapshot();
          }}
          onClose={() => {
            dismissedKeyRef.current = selectedKey;
            selectedKeyRef.current = null;
            setSelectedKey(null);
            setKeyDetails(null);
          }}
        />
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
              <th className="px-3 py-2">{t('key')}</th>
              <th className="px-3 py-2">{t('limiter')}</th>
              <th className="px-3 py-2">{t('hits')}</th>
              <th className="px-3 py-2">{t('status')}</th>
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 && (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-zinc-400">
                  {t('noEntries')}
                </td>
              </tr>
            )}
            {entries.map((entry, i) => (
              <tr
                key={`${entry.key}-${entry.limiterLabel}-${i}`}
                onClick={() => handleKeyClick(entry.key)}
                className={`cursor-pointer border-b border-zinc-100 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-800/50 ${
                  selectedKey === entry.key
                    ? 'bg-zinc-100 dark:bg-zinc-800'
                    : ''
                }`}
              >
                <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs sm:max-w-none">
                  {entry.key}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500 dark:text-zinc-400">
                  {LIMITER_DISPLAY[entry.limiterLabel] ?? entry.limiterLabel}
                </td>
                <td className="px-3 py-2 text-xs">
                  {entry.count}/{entry.maxRequests}
                </td>
                <td className="px-3 py-2">
                  {entry.blocked ? (
                    <span className="inline-block rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                      {t('blocked')}
                    </span>
                  ) : (
                    <span className="inline-block rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      {t('ok')}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
