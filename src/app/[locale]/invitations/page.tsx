import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getUserPendingInvitesAction } from '@/src/web/actions/invitation/invitation';
import { Link } from '@/src/i18n/routing';
import { PendingInvitationsList } from './PendingInvitationsList';

export default async function InvitationsPage() {
  const t = await getTranslations('invitation');
  const tCommon = await getTranslations('common');

  const result = await getUserPendingInvitesAction();

  const invites = result.success ? result.data : [];

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
        {invites.length === 0 ? (
          <Text className="text-zinc-500 dark:text-zinc-400">
            {t('noInvitations')}
          </Text>
        ) : (
          <PendingInvitationsList initialInvites={invites} />
        )}
      </div>
    </AuthenticatedLayout>
  );
}
