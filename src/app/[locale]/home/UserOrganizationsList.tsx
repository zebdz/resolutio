'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Divider } from '@/src/web/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import { getUserOrganizationsAction } from '@/src/web/actions/organization/organization';

interface UserOrganization {
  id: string;
  name: string;
  description: string;
  joinedAt?: Date;
  archivedAt?: Date | null;
  parentOrg?: { id: string; name: string } | null;
}

interface AdminOrganization {
  id: string;
  name: string;
  description: string;
  archivedAt?: Date | null;
  parentOrg?: { id: string; name: string } | null;
}

interface UserOrganizationsListProps {
  adminOrganizations: AdminOrganization[];
}

export function UserOrganizationsList({
  adminOrganizations,
}: UserOrganizationsListProps) {
  const t = useTranslations('home');
  const tOrg = useTranslations('organization');
  const [member, setMember] = useState<UserOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadOrganizations = async () => {
      setIsLoading(true);
      setError(null);
      const result = await getUserOrganizationsAction();

      if (result.success) {
        setMember(
          result.data.member.map((org) => ({
            ...org,
            joinedAt: new Date(org.joinedAt),
            archivedAt: org.archivedAt ? new Date(org.archivedAt) : null,
            parentOrg: org.parentOrg,
          }))
        );
      } else {
        setError(result.error);
      }

      setIsLoading(false);
    };

    loadOrganizations();
  }, [adminOrganizations]);

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Text className="text-center text-zinc-500">Loading...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <Text className="text-red-800 dark:text-red-200">{error}</Text>
      </div>
    );
  }

  const memberIds = new Set(member.map((org) => org.id));
  const adminOnlyOrgs = adminOrganizations.filter(
    (org) => !memberIds.has(org.id)
  );
  const adminIdSet = new Set(adminOrganizations.map((org) => org.id));

  const hasOrganizations = member.length > 0 || adminOnlyOrgs.length > 0;

  if (!hasOrganizations) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <Text className="text-lg text-zinc-500 dark:text-zinc-400">
          {t('noOrganizations')}
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Member Organizations */}
      {member.length > 0 && (
        <div>
          <Heading level={2} className="mb-4">
            {t('myOrganizations')}
          </Heading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {member.map((org) => (
              <Link
                key={org.id}
                href={`/organizations/${org.id}`}
                prefetch={false}
                className={`block rounded-lg border p-6 transition-shadow hover:shadow-md ${
                  org.archivedAt
                    ? 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950'
                    : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                }`}
              >
                {org.parentOrg && (
                  <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {tOrg('parentOrg', { name: org.parentOrg.name })}
                  </Text>
                )}
                <div className="flex items-start justify-between">
                  <Heading level={3} className="text-lg font-semibold">
                    {org.name}
                  </Heading>
                  <div className="flex gap-1">
                    {org.archivedAt && (
                      <Badge color="pink">{t('archivedBadge')}</Badge>
                    )}
                    {adminIdSet.has(org.id) && (
                      <Badge color="purple">{t('admin')}</Badge>
                    )}
                    <Badge color="green">{t('member')}</Badge>
                  </div>
                </div>
                <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {org.description}
                </Text>
                {org.joinedAt && (
                  <Text className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                    {t('joinedAt')} {org.joinedAt.toLocaleDateString()}
                  </Text>
                )}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Admin-only Organizations */}
      {adminOnlyOrgs.length > 0 && (
        <>
          {member.length > 0 && <Divider className="my-8" />}
          <div>
            <Heading level={2} className="mb-4">
              {t('myAdminOrganizations')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adminOnlyOrgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  prefetch={false}
                  className={`block rounded-lg border p-6 transition-shadow hover:shadow-md ${
                    org.archivedAt
                      ? 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                  }`}
                >
                  {org.parentOrg && (
                    <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {tOrg('parentOrg', { name: org.parentOrg.name })}
                    </Text>
                  )}
                  <div className="flex items-start justify-between">
                    <Heading level={3} className="text-lg font-semibold">
                      {org.name}
                    </Heading>
                    <div className="flex gap-1">
                      {org.archivedAt && (
                        <Badge color="pink">{t('archivedBadge')}</Badge>
                      )}
                      <Badge color="purple">{t('admin')}</Badge>
                    </div>
                  </div>
                  <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {org.description}
                  </Text>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
