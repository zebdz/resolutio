'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import {
  getRateLimitOverviewAction,
  resetAllRateLimitsAction,
  type LimiterOverview,
} from '@/web/actions/rateLimitAdmin';
import { LimiterCard } from './LimiterCard';
import { ConfirmDialog } from './ConfirmDialog';

export function RateLimitsPanel() {
  const t = useTranslations('superadmin.rateLimits');
  const [overviews, setOverviews] = useState<LimiterOverview[]>([]);
  const [isResetAllOpen, setIsResetAllOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    const result = await getRateLimitOverviewAction();

    if (result.success) {
      setOverviews(result.data);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    getRateLimitOverviewAction().then((result) => {
      if (!cancelled && result.success) {
        setOverviews(result.data);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  const handleResetAll = async () => {
    setIsLoading(true);
    setError(null);
    const result = await resetAllRateLimitsAction();

    if (result.success) {
      setIsResetAllOpen(false);
      await fetchOverview();
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button color="red" onClick={() => setIsResetAllOpen(true)}>
          {t('resetAll')}
        </Button>
      </div>

      <div className="space-y-3">
        {overviews.map((ov) => (
          <LimiterCard key={ov.label} overview={ov} onMutate={fetchOverview} />
        ))}
      </div>

      <ConfirmDialog
        isOpen={isResetAllOpen}
        onClose={() => setIsResetAllOpen(false)}
        title={t('resetAllConfirmTitle')}
        description={t('resetAllConfirmDescription')}
        onConfirm={handleResetAll}
        isLoading={isLoading}
        error={error}
        confirmLabel={t('confirm')}
        cancelLabel={t('cancel')}
        confirmColor="red"
      />
    </div>
  );
}
