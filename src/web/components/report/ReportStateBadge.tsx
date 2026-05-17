'use client';

import { useTranslations } from 'next-intl';

interface Props {
  state: 'DRAFT' | 'PUBLISHED';
  archived?: boolean;
}

export function ReportStateBadge({ state, archived }: Props) {
  const t = useTranslations('report.state');

  if (archived) {
    return (
      <span className="inline-flex items-center rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
        {t('archived')}
      </span>
    );
  }

  if (state === 'PUBLISHED') {
    return (
      <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
        {t('published')}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/40 dark:text-amber-200">
      {t('draft')}
    </span>
  );
}
