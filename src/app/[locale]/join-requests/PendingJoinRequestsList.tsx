'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Button } from '@/src/web/components/catalyst/button';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Divider } from '@/src/web/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import {
  cancelJoinRequestAction,
  joinOrganizationAction,
} from '@/src/web/actions/organization/organization';
import { User } from '@/domain/user/User';

interface PendingOrganization {
  id: string;
  name: string;
  description: string;
  requestedAt: string;
  parentOrg: { id: string; name: string } | null;
}

interface RejectedOrganization {
  id: string;
  name: string;
  description: string;
  rejectedAt: string;
  rejectionReason: string | null;
  rejectedBy: {
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  };
  parentOrg: { id: string; name: string } | null;
}

interface PendingJoinRequestsListProps {
  initialPending: PendingOrganization[];
  initialRejected: RejectedOrganization[];
}

export function PendingJoinRequestsList({
  initialPending,
  initialRejected,
}: PendingJoinRequestsListProps) {
  const t = useTranslations('home');
  const [pending, setPending] = useState(initialPending);
  const [rejected, setRejected] = useState(initialRejected);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [reRequestingId, setReRequestingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async (organizationId: string) => {
    setCancellingId(organizationId);
    const result = await cancelJoinRequestAction(organizationId);

    if (result.success) {
      setPending((prev) => prev.filter((org) => org.id !== organizationId));
    } else {
      setError(result.error);
    }

    setCancellingId(null);
  };

  const handleReRequest = async (organizationId: string) => {
    setReRequestingId(organizationId);
    const formData = new FormData();
    formData.append('organizationId', organizationId);
    const result = await joinOrganizationAction(formData);

    if (result.success) {
      const org = rejected.find((o) => o.id === organizationId);
      setRejected((prev) => prev.filter((o) => o.id !== organizationId));

      if (org) {
        setPending((prev) => [
          ...prev,
          {
            id: org.id,
            name: org.name,
            description: org.description,
            requestedAt: new Date().toISOString(),
            parentOrg: org.parentOrg,
          },
        ]);
      }
    } else {
      setError(result.error);
    }

    setReRequestingId(null);
  };

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <Text className="text-red-800 dark:text-red-200">{error}</Text>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Pending Requests */}
      {pending.length > 0 && (
        <div>
          <Heading level={2} className="mb-4">
            {t('pendingRequests')}
          </Heading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {pending.map((org) => (
              <div
                key={org.id}
                className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <Link
                  href={`/organizations/${org.id}`}
                  prefetch={false}
                  className="block"
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
                      {new Date(org.requestedAt).toLocaleDateString()}
                    </Text>
                  )}
                </Link>
                <div className="mt-4">
                  <Button
                    color="red"
                    onClick={() => handleCancel(org.id)}
                    disabled={cancellingId === org.id}
                  >
                    {cancellingId === org.id
                      ? t('joinRequest.cancelling')
                      : t('joinRequest.cancel')}
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rejected Requests */}
      {rejected.length > 0 && (
        <>
          {pending.length > 0 && <Divider className="my-8" />}
          <div>
            <Heading level={2} className="mb-4">
              {t('rejectedRequests')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {rejected.map((org) => (
                <div
                  key={org.id}
                  className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950"
                >
                  <Link
                    href={`/organizations/${org.id}`}
                    prefetch={false}
                    className="block"
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
                        {t('joinRequest.rejectedBy')}{' '}
                        {User.formatFullName(
                          org.rejectedBy.firstName,
                          org.rejectedBy.lastName,
                          org.rejectedBy.middleName
                        )}{' '}
                        {t('joinRequest.rejectedOn')}{' '}
                        {new Date(org.rejectedAt).toLocaleDateString()}
                      </Text>
                    )}
                  </Link>
                  <div className="mt-4">
                    <Button
                      color="brand-green"
                      onClick={() => handleReRequest(org.id)}
                      disabled={reRequestingId === org.id}
                    >
                      {reRequestingId === org.id
                        ? t('joinRequest.reRequesting')
                        : t('joinRequest.reRequest')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
