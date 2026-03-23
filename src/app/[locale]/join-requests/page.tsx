import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { getUserOrganizationsAction } from '@/web/actions/organization';
import { Link } from '@/src/i18n/routing';
import { PendingJoinRequestsList } from './PendingJoinRequestsList';

export default async function JoinRequestsPage() {
  const t = await getTranslations('joinRequests');
  const tCommon = await getTranslations('common');

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
        <div className="space-y-2">
          <Link
            href="/home"
            className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {tCommon('backToHome')}
          </Link>
          <Heading className="text-3xl font-bold">{t('listTitle')}</Heading>
        </div>
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
