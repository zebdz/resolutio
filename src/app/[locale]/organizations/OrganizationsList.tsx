'use client';

import { useState, useEffect, useRef, useCallback, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Input } from '@/app/components/catalyst/input';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Badge } from '@/app/components/catalyst/badge';
import { Link } from '@/src/i18n/routing';
import {
  joinOrganizationAction,
  searchOrganizationsAction,
} from '@/web/actions/organization';

const PAGE_SIZE = 30;

interface Organization {
  id: string;
  name: string;
  description: string;
  memberCount: number;
  firstAdmin: { id: string; firstName: string; lastName: string } | null;
  parentOrg?: { id: string; name: string } | null;
}

interface OrganizationsListProps {
  initialOrganizations: Organization[];
  initialTotalCount: number;
  userId: string;
}

export function OrganizationsList({
  initialOrganizations,
  initialTotalCount,
}: OrganizationsListProps) {
  const t = useTranslations('organization.list');
  const tOrg = useTranslations('organization');
  const router = useRouter();

  const [organizations, setOrganizations] =
    useState<Organization[]>(initialOrganizations);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isPending, startTransition] = useTransition();
  const [joiningOrgId, setJoiningOrgId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(page);
  const searchRef = useRef(search);
  pageRef.current = page;
  searchRef.current = search;

  const hasMore = organizations.length < totalCount;

  // Debounced search: reset list, fetch page 1
  useEffect(() => {
    // Skip initial render (page already has SSR data)
    if (search === '' && page === 1 && organizations === initialOrganizations) {
      return;
    }

    const timer = setTimeout(() => {
      startTransition(async () => {
        const result = await searchOrganizationsAction({
          search: search || undefined,
          page: 1,
          pageSize: PAGE_SIZE,
        });

        if (result.success) {
          setOrganizations(result.data.organizations);
          setTotalCount(result.data.totalCount);
          setPage(1);
        }
      });
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Load next page
  const loadMore = useCallback(() => {
    if (isPending) {
      return;
    }

    const nextPage = pageRef.current + 1;
    setPage(nextPage);

    startTransition(async () => {
      const result = await searchOrganizationsAction({
        search: searchRef.current || undefined,
        page: nextPage,
        pageSize: PAGE_SIZE,
      });

      if (result.success) {
        setOrganizations((prev) => [...prev, ...result.data.organizations]);
        setTotalCount(result.data.totalCount);
      }
    });
  }, [isPending]);

  // IntersectionObserver for infinite scroll
  useEffect(() => {
    const sentinel = sentinelRef.current;

    if (!sentinel) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadMore();
        }
      },
      { threshold: 0.1 }
    );

    observer.observe(sentinel);

    return () => observer.disconnect();
  }, [loadMore]);

  const handleJoin = async (organizationId: string) => {
    setJoiningOrgId(organizationId);
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append('organizationId', organizationId);

    const result = await joinOrganizationAction(formData);

    if (result.success) {
      setSuccess(t('joinSuccess'));
    } else {
      setError(result.error);
    }

    setJoiningOrgId(null);
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <div>
        <Input
          type="text"
          placeholder={t('search')}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-md"
        />
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="rounded-md bg-green-50 p-4 dark:bg-green-900/10">
          <p className="text-sm text-green-800 dark:text-green-200">
            {success}
          </p>
        </div>
      )}

      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/10">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Organizations Grid */}
      {organizations.length === 0 && !isPending ? (
        <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <Text className="text-lg text-zinc-500 dark:text-zinc-400">
            {search ? t('noSearchResults') : t('noOrganizations')}
          </Text>
        </div>
      ) : (
        <>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {organizations.map((org) => (
              <div
                key={org.id}
                className="flex flex-col rounded-lg border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
              >
                {/* Parent org label — fixed height so cards align */}
                <div className="mb-1 min-h-[1.25rem]">
                  {org.parentOrg && (
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                      {tOrg('parentOrg', { name: org.parentOrg.name })}
                    </Text>
                  )}
                </div>

                <Link href={`/organizations/${org.id}`}>
                  <Heading
                    level={3}
                    className="text-lg font-semibold hover:text-brand-green"
                  >
                    {org.name}
                  </Heading>
                </Link>

                <Text className="mt-2 line-clamp-3 flex-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {org.description}
                </Text>

                <div className="mt-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge color="zinc">
                      {t('memberCount', { count: org.memberCount })}
                    </Badge>
                  </div>

                  {org.firstAdmin && (
                    <Text className="text-xs text-zinc-500 dark:text-zinc-400">
                      {t('admin')}: {org.firstAdmin.firstName}{' '}
                      {org.firstAdmin.lastName}
                    </Text>
                  )}
                </div>

                <Button
                  color="brand-green"
                  className="mt-4 w-full"
                  onClick={() => handleJoin(org.id)}
                  disabled={joiningOrgId === org.id}
                >
                  {joiningOrgId === org.id ? t('joining') : t('joinButton')}
                </Button>
              </div>
            ))}
          </div>

          {/* Sentinel for infinite scroll */}
          {hasMore && (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isPending && (
                <Text className="text-sm text-zinc-500 dark:text-zinc-400">
                  {t('loadingMore')}
                </Text>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
