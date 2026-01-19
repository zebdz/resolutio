'use client';

import { useTranslations } from 'next-intl';

interface VotingProgressProps {
  current: number;
  total: number;
  percentage: number;
  pages: number[];
  currentPage: number;
  onPageClick: (page: number) => void;
}

export default function VotingProgress({
  current,
  total,
  percentage,
  pages,
  currentPage,
  onPageClick,
}: VotingProgressProps) {
  const t = useTranslations('poll.voting');

  return (
    <div className="space-y-4">
      {/* Progress bar */}
      <div className="relative">
        <div className="h-2 bg-zinc-200 dark:bg-zinc-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 dark:bg-blue-500 transition-all duration-300"
            style={{ width: `${percentage}%` }}
          />
        </div>
        <div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 text-center">
          {t('progress', { current, total })}
        </div>
      </div>

      {/* Page dots */}
      {pages.length > 1 && (
        <div className="flex items-center justify-center gap-2">
          {pages.map((page) => (
            <button
              key={page}
              onClick={() => onPageClick(page)}
              className={`h-2 w-2 rounded-full transition-all ${
                page === currentPage
                  ? 'bg-blue-600 dark:bg-blue-500 w-8'
                  : 'bg-zinc-300 dark:bg-zinc-600 hover:bg-zinc-400 dark:hover:bg-zinc-500'
              }`}
              aria-label={`Page ${page}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
