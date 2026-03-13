'use client';

import { useTranslations } from 'next-intl';
import { Badge } from '@/app/components/catalyst/badge';
import { MembersListContent, OrgMember } from './MembersListContent';

type Props = {
  organizationId: string;
  initialMembers: OrgMember[];
  initialTotalCount: number;
};

export function OrgMembersList({
  organizationId,
  initialMembers,
  initialTotalCount,
}: Props) {
  const t = useTranslations('organization.detail');

  return (
    <details className="group rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <summary className="flex cursor-pointer list-none items-center justify-between p-6 [&::-webkit-details-marker]:hidden">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
            {t('members')}
          </h2>
          <Badge color="zinc">
            {t('memberCount', { count: initialTotalCount })}
          </Badge>
        </div>
        <svg
          className="h-5 w-5 shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </summary>

      <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        <MembersListContent
          organizationId={organizationId}
          initialMembers={initialMembers}
          initialTotalCount={initialTotalCount}
        />
      </div>
    </details>
  );
}
