'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import { Badge } from '@/app/components/catalyst/badge';
import { Input } from '@/app/components/catalyst/input';
import { Link } from '@/src/i18n/routing';
import { User } from '@/domain/user/User';
import { getOrgMembersAction } from '@/web/actions/invitation';

type OrgMember = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  joinedAt: Date | null;
};

type Props = {
  organizationId: string;
  initialMembers: OrgMember[];
  initialTotalCount: number;
  isAdmin: boolean;
};

const PAGE_SIZE = 20;

export function OrgMembersList({
  organizationId,
  initialMembers,
  initialTotalCount,
  isAdmin,
}: Props) {
  const t = useTranslations('organization.detail');
  const [members, setMembers] = useState<OrgMember[]>(initialMembers);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const fetchMembers = useCallback(
    async (p: number, q: string) => {
      setIsLoading(true);
      const result = await getOrgMembersAction(
        organizationId,
        p,
        PAGE_SIZE,
        q || undefined
      );

      if (result.success) {
        setMembers(result.data.members);
        setTotalCount(result.data.totalCount);
      }

      setIsLoading(false);
    },
    [organizationId]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchMembers(1, query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, fetchMembers]);

  // Page changes
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchMembers(newPage, query);
  };

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
        <div className="flex items-center gap-3">
          {isAdmin && (
            <Link
              href={`/organizations/${organizationId}/manage-members`}
              onClick={(e) => e.stopPropagation()}
            >
              <Button color="zinc">{t('manageMembers')}</Button>
            </Link>
          )}
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
        </div>
      </summary>

      <div className="border-t border-zinc-200 px-6 py-4 dark:border-zinc-800">
        {/* Search */}
        <div className="mb-4">
          <Input
            type="text"
            placeholder={t('searchMembers')}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* Members list */}
        {isLoading ? (
          <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            ...
          </div>
        ) : members.length === 0 ? (
          <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
            {t('noMembersFound')}
          </div>
        ) : (
          <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
            {members.map((member) => (
              <li
                key={member.id}
                className="py-2 text-sm text-zinc-700 dark:text-zinc-300"
              >
                {User.formatFullName(
                  member.firstName,
                  member.lastName,
                  member.middleName
                )}{' '}
                <span className="text-zinc-400">(@{member.nickname})</span>
              </li>
            ))}
          </ul>
        )}

        {/* Pagination */}
        {totalCount > 0 && (
          <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              {t('showingMembers', { from, to, total: totalCount })}
            </span>
            <div className="flex gap-2">
              <Button
                plain
                disabled={page <= 1}
                onClick={() => handlePageChange(page - 1)}
              >
                {t('previousPage')}
              </Button>
              <Button
                plain
                disabled={page >= totalPages}
                onClick={() => handlePageChange(page + 1)}
              >
                {t('nextPage')}
              </Button>
            </div>
          </div>
        )}
      </div>
    </details>
  );
}
