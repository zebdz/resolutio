import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { listOrganizationsAction } from '@/web/actions/organization';
import { OrganizationsList } from './OrganizationsList';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

export default async function OrganizationsPage() {
  const t = await getTranslations('organization.list');
  const user = await getCurrentUser();

  if (!user) {
    return <AuthenticatedLayout>{null}</AuthenticatedLayout>;
  }

  // Fetch organizations
  const result = await listOrganizationsAction();
  const organizations = result.success ? result.data.organizations : [];

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

        {/* Organizations List */}
        <OrganizationsList organizations={organizations} userId={user.id} />
      </div>
    </AuthenticatedLayout>
  );
}
