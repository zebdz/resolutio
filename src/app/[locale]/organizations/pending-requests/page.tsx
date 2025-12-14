import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { getPendingRequestsAction } from '@/web/actions/organization';
import { PendingRequestsList } from './PendingRequestsList';

export default async function PendingRequestsPage() {
  const t = await getTranslations('organization.pendingRequests');
  const tAccount = await getTranslations('account');
  const tCommon = await getTranslations('common');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch pending requests for organizations where user is admin
  const result = await getPendingRequestsAction();
  const requests = result.success ? result.data.requests : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Heading className="text-3xl font-bold">{t('title')}</Heading>
            <Text className="text-zinc-600 dark:text-zinc-400">
              {t('subtitle')}
            </Text>
          </div>
          <div className="flex gap-2">
            <Link href="/home">
              <Button color="zinc">{tCommon('back')}</Button>
            </Link>
            <Link href="/account">
              <Button color="zinc">{tAccount('button')}</Button>
            </Link>
          </div>
        </div>

        {/* Pending Requests List */}
        <PendingRequestsList requests={requests} />
      </div>
    </main>
  );
}
