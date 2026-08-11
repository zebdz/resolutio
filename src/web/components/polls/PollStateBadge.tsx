'use client';

import { useTranslations } from 'next-intl';
import {
  ClockIcon,
  CalendarIcon,
  InboxArrowDownIcon,
} from '@heroicons/react/24/outline';
import { PollState } from '@/domain/poll/PollState';

interface PollStateBadgeProps {
  state: string;
}

export function PollStateBadge({ state }: PollStateBadgeProps) {
  const t = useTranslations('poll');

  switch (state) {
    case PollState.ACTIVE:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20 rounded-full">
          <ClockIcon className="w-3 h-3" />
          {t('active')}
        </span>
      );
    // Distinct from the other pre-voting states on purpose: "waiting for an
    // admin" is the one an admin needs to pick out of a list at a glance.
    case PollState.SUBMITTED:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 dark:text-amber-400 dark:bg-amber-900/20 rounded-full">
          <InboxArrowDownIcon className="w-3 h-3" />
          {t('submitted')}
        </span>
      );
    case PollState.DRAFT:
    case PollState.READY:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20 rounded-full">
          <CalendarIcon className="w-3 h-3" />
          {t('upcoming')}
        </span>
      );
    case PollState.FINISHED:
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-500 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800 rounded-full">
          {t('finished')}
        </span>
      );
    default:
      return null;
  }
}
