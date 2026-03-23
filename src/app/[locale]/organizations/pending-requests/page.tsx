import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { getPendingRequestsAction } from '@/src/web/actions/organization/organization';
import { PendingRequestsList } from './PendingRequestsList';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';

const DEFAULT_PAGE_SIZE = 10;

export default async function PendingRequestsPage() {
  const t = await getTranslations('organization.pendingRequests');

  // Fetch first page of pending requests
  const result = await getPendingRequestsAction(1, DEFAULT_PAGE_SIZE);
  const requests = result.success ? result.data.requests : [];
  const totalCount = result.success ? result.data.totalCount : 0;

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
        <PendingRequestsList
          requests={requests}
          totalCount={totalCount}
          defaultPageSize={DEFAULT_PAGE_SIZE}
        />
      </div>
    </AuthenticatedLayout>
  );
}
