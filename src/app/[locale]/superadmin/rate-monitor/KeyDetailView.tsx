'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { resetRateLimitKeysAction } from '@/web/actions/rateLimitAdmin';
import type { KeyLimiterDetail } from '@/web/actions/rateLimitMonitor';

interface KeyDetailViewProps {
  keyName: string;
  details: KeyLimiterDetail[];
  onRefresh: () => void;
  onClose: () => void;
}

const LIMITER_LABELS: Record<string, string> = {
  middlewareSession: 'MW (Session)',
  middlewareIp: 'MW (IP)',
  serverActionSession: 'SA (Session)',
  serverActionIp: 'SA (IP)',
  phoneSearch: 'Phone Search',
  login: 'Login',
  registrationIp: 'Registration (IP)',
  registrationDevice: 'Registration (Device)',
};

export function KeyDetailView({
  keyName,
  details,
  onRefresh,
  onClose,
}: KeyDetailViewProps) {
  const t = useTranslations('superadmin.monitor');
  const [unlocking, setUnlocking] = useState<string | null>(null);

  const handleUnlock = async (limiterLabel: string) => {
    setUnlocking(limiterLabel);
    const result = await resetRateLimitKeysAction({
      label: limiterLabel,
      keys: [keyName],
    });

    if (result.success) {
      onRefresh();
    }

    setUnlocking(null);
  };

  function getBarColor(
    count: number,
    maxRequests: number,
    blocked: boolean
  ): string {
    if (blocked) {
      return 'bg-red-500';
    }

    const ratio = count / maxRequests;

    if (ratio >= 0.75) {
      return 'bg-yellow-500';
    }

    return 'bg-green-500';
  }

  return (
    <div className="relative rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <button
        type="button"
        onClick={onClose}
        className="absolute top-3 right-3 cursor-pointer text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300"
        aria-label="Close"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 20 20"
          fill="currentColor"
          className="h-5 w-5"
        >
          <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
        </svg>
      </button>
      <h3 className="mb-4 pr-6 font-mono text-sm font-semibold">{keyName}</h3>
      <div className="space-y-3">
        {details.length === 0 && (
          <p className="text-sm text-zinc-500">{t('noData')}</p>
        )}
        {details.map((detail) => {
          const pct =
            detail.maxRequests > 0
              ? Math.min((detail.count / detail.maxRequests) * 100, 100)
              : 0;

          return (
            <div key={detail.limiterLabel} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-600 dark:text-zinc-400">
                  {LIMITER_LABELS[detail.limiterLabel] ?? detail.limiterLabel}:{' '}
                  {detail.count}/{detail.maxRequests}
                </span>
                {detail.blocked && (
                  <Button
                    color="red"
                    onClick={() => handleUnlock(detail.limiterLabel)}
                    disabled={unlocking === detail.limiterLabel}
                    className="!px-2 !py-0.5 text-xs"
                  >
                    {unlocking === detail.limiterLabel ? '...' : t('unlock')}
                  </Button>
                )}
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
                <div
                  className={`h-full rounded-full transition-all ${getBarColor(detail.count, detail.maxRequests, detail.blocked)}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
