'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';

export default function RateLimitedPage() {
  const t = useTranslations('rateLimit');
  const router = useRouter();
  const searchParams = useSearchParams();

  const initialSeconds = Math.max(
    1,
    parseInt(searchParams.get('retryAfter') ?? '60', 10) || 60
  );
  const [secondsLeft, setSecondsLeft] = useState(initialSeconds);

  useEffect(() => {
    if (secondsLeft <= 0) {return;}

    const timer = setTimeout(() => {
      setSecondsLeft((s) => s - 1);
    }, 1000);

    return () => clearTimeout(timer);
  }, [secondsLeft]);

  function handleRetry() {
    const from = searchParams.get('from');
    router.push(from || '/');
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-6xl">429</div>
        <h1 className="mb-4 text-2xl font-bold text-gray-900">{t('title')}</h1>
        <p className="mb-6 text-gray-600">{t('message')}</p>

        {secondsLeft > 0 ? (
          <p className="mb-8 text-lg font-medium text-gray-700">
            {t('waitMessage', { seconds: secondsLeft })}
          </p>
        ) : null}

        <Button
          color="brand-green"
          className="w-full justify-center"
          disabled={secondsLeft > 0}
          onClick={handleRetry}
        >
          {t('retryButton')}
        </Button>
      </div>
    </div>
  );
}
