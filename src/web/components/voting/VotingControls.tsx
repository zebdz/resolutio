'use client';

import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';

interface VotingControlsProps {
  isFirstPage: boolean;
  isLastPage: boolean;
  canFinish: boolean;
  isSaving: boolean;
  isFinishing: boolean;
  onPrevious: () => void;
  onNext: () => void;
  onFinish: () => void;
}

export default function VotingControls({
  isFirstPage,
  isLastPage,
  canFinish,
  isSaving,
  isFinishing,
  onPrevious,
  onNext,
  onFinish,
}: VotingControlsProps) {
  const t = useTranslations('poll.voting');

  return (
    <div className="flex items-center justify-between pt-6 border-t border-zinc-200 dark:border-zinc-700">
      <div>
        {!isFirstPage && (
          <Button
            type="button"
            onClick={onPrevious}
            disabled={isSaving || isFinishing}
            color="white"
          >
            {t('previous')}
          </Button>
        )}
      </div>

      <div className="flex gap-3">
        {isSaving && (
          <span className="text-sm text-zinc-600 dark:text-zinc-400 flex items-center">
            {t('savingDraft')}
          </span>
        )}

        {!isLastPage ? (
          <Button
            type="button"
            onClick={onNext}
            disabled={isSaving || isFinishing}
          >
            {t('next')}
          </Button>
        ) : (
          <Button
            type="button"
            onClick={onFinish}
            disabled={!canFinish || isFinishing}
            color="blue"
          >
            {isFinishing ? t('finishing') : t('finish')}
          </Button>
        )}
      </div>
    </div>
  );
}
