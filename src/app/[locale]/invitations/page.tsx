import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { getUserPendingInvitesAction } from '@/web/actions/invitation';
import { PendingInvitationsList } from './PendingInvitationsList';

export default async function InvitationsPage() {
  const t = await getTranslations('invitation');

  const result = await getUserPendingInvitesAction();

  const invites = result.success ? result.data : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('listTitle')}</Heading>
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
