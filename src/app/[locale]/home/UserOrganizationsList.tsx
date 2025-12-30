'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/app/components/catalyst/badge';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Divider } from '@/app/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import { getUserOrganizationsAction } from '@/web/actions/organization';

interface UserOrganization {
  id: string;
  name: string;
  description: string;
  joinedAt?: Date;
  requestedAt?: Date;
  rejectedAt?: Date;
  rejectionReason?: string | null;
  rejectedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  };
}

export function UserOrganizationsList() {
  const t = useTranslations('home');
  const [member, setMember] = useState<UserOrganization[]>([]);
  const [pending, setPending] = useState<UserOrganization[]>([]);
  const [rejected, setRejected] = useState<UserOrganization[]>([]);
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
          }))
        );
        setPending(
          result.data.pending.map((org) => ({
            ...org,
            requestedAt: new Date(org.requestedAt),
          }))
        );
        setRejected(
          result.data.rejected.map((org) => ({
            ...org,
            rejectedAt: new Date(org.rejectedAt),
          }))
        );
      } else {
        setError(result.error);
      }

      setIsLoading(false);
    };

    loadOrganizations();
  }, []);

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

  const hasOrganizations =
    member.length > 0 || pending.length > 0 || rejected.length > 0;

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
                className="block rounded-lg border border-zinc-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between">
                  <Heading level={3} className="text-lg font-semibold">
                    {org.name}
                  </Heading>
                  <Badge color="green">{t('member')}</Badge>
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

      {/* Pending Requests */}
      {pending.length > 0 && (
        <>
          {member.length > 0 && <Divider className="my-8" />}
          <div>
            <Heading level={2} className="mb-4">
              {t('pendingRequests')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {pending.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  className="block rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="flex items-start justify-between">
                    <Heading level={3} className="text-lg font-semibold">
                      {org.name}
                    </Heading>
                    <Badge color="yellow">{t('joinRequest.pending')}</Badge>
                  </div>
                  <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {org.description}
                  </Text>
                  {org.requestedAt && (
                    <Text className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                      {t('joinRequest.requested')}{' '}
                      {org.requestedAt.toLocaleDateString()}
                    </Text>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Rejected Requests */}
      {rejected.length > 0 && (
        <>
          {(member.length > 0 || pending.length > 0) && (
            <Divider className="my-8" />
          )}
          <div>
            <Heading level={2} className="mb-4">
              {t('rejectedRequests')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rejected.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  className="block rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950"
                >
                  <div className="flex items-start justify-between">
                    <Heading level={3} className="text-lg font-semibold">
                      {org.name}
                    </Heading>
                    <Badge color="red">{t('joinRequest.rejected')}</Badge>
                  </div>
                  <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {org.description}
                  </Text>
                  {org.rejectionReason && (
                    <div className="mt-4 rounded-md bg-red-100 p-3 dark:bg-red-900/20">
                      <Text className="text-sm font-medium text-red-800 dark:text-red-200">
                        {t('joinRequest.reason')}:
                      </Text>
                      <Text className="mt-1 text-sm text-red-700 dark:text-red-300">
                        {org.rejectionReason}
                      </Text>
                    </div>
                  )}
                  {org.rejectedBy && org.rejectedAt && (
                    <Text className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                      {t('joinRequest.rejectedBy')} {org.rejectedBy.firstName}{' '}
                      {org.rejectedBy.lastName} {t('joinRequest.rejectedOn')}{' '}
                      {org.rejectedAt.toLocaleDateString()}
                    </Text>
                  )}
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
