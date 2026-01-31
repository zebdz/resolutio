import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { getPendingRequestsAction } from '@/web/actions/organization';
import { PendingRequestsList } from './PendingRequestsList';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

export default async function PendingRequestsPage() {
  const t = await getTranslations('organization.pendingRequests');

  // Fetch pending requests for organizations where user is admin
  const result = await getPendingRequestsAction();
  const requests = result.success ? result.data.requests : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Heading className="text-3xl font-bold">{t('title')}</Heading>
          <Text className="text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </Text>
        </div>

        {/* Pending Requests List */}
        <PendingRequestsList requests={requests} />
      </div>
    </AuthenticatedLayout>
  );
}
