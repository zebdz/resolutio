'use client';

import { useState, useEffect, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { User } from '@/domain/user/User';
import { getOrgAdminsPaginatedAction } from '@/src/web/actions/organization/organization';

export type OrgAdmin = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  createdAt: Date;
};

type Props = {
  organizationId: string;
  initialAdmins: OrgAdmin[];
  initialTotalCount: number;
};

const PAGE_SIZE = 20;

export function AdminsListContent({
  organizationId,
  initialAdmins,
  initialTotalCount,
}: Props) {
  const t = useTranslations('organization.detail');
  const [admins, setAdmins] = useState<OrgAdmin[]>(initialAdmins);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const fetchAdmins = useCallback(
    async (p: number, q: string) => {
      setIsLoading(true);
      const result = await getOrgAdminsPaginatedAction(
        organizationId,
        p,
        PAGE_SIZE,
        q || undefined
      );

      if (result.success) {
        setAdmins(result.data.admins);
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
      fetchAdmins(1, query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, fetchAdmins]);

  // Page changes
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchAdmins(newPage, query);
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder={t('searchAdmins')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Admins list */}
      {isLoading ? (
        <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          ...
        </div>
      ) : admins.length === 0 ? (
        <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('noAdminsFound')}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {admins.map((admin) => (
            <li
              key={admin.id}
              className="py-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              {User.formatFullName(
                admin.firstName,
                admin.lastName,
                admin.middleName
              )}{' '}
              <span className="text-zinc-400">(@{admin.nickname})</span>
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('showingAdmins', { from, to, total: totalCount })}
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
  );
}
