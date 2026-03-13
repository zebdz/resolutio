import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { getUserOrganizationsAction } from '@/web/actions/organization';
import { PendingJoinRequestsList } from './PendingJoinRequestsList';

export default async function JoinRequestsPage() {
  const t = await getTranslations('joinRequests');

  const result = await getUserOrganizationsAction();

  const pending = result.success
    ? result.data.pending.map((org) => ({
        ...org,
        requestedAt: new Date(org.requestedAt).toISOString(),
      }))
    : [];

  const rejected = result.success
    ? result.data.rejected.map((org) => ({
        ...org,
        rejectedAt: new Date(org.rejectedAt).toISOString(),
      }))
    : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('listTitle')}</Heading>
        {pending.length === 0 && rejected.length === 0 ? (
          <Text className="text-zinc-500 dark:text-zinc-400">
            {t('noRequests')}
          </Text>
        ) : (
          <PendingJoinRequestsList
            initialPending={pending}
            initialRejected={rejected}
          />
        )}
      </div>
    </AuthenticatedLayout>
  );
}
