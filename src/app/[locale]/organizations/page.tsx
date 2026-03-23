import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { searchOrganizationsNotAlreadyMemberOfAction } from '@/web/actions/organization';
import { OrganizationsList } from './OrganizationsList';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

const PAGE_SIZE = 30;

export default async function OrganizationsPage() {
  const t = await getTranslations('organization.list');
  const user = await getCurrentUser();

  if (!user) {
    return <AuthenticatedLayout>{null}</AuthenticatedLayout>;
  }

  const result = await searchOrganizationsNotAlreadyMemberOfAction({
    page: 1,
    pageSize: PAGE_SIZE,
  });
  const organizations = result.success ? result.data.organizations : [];
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

        {/* Organizations List */}
        <OrganizationsList
          initialOrganizations={organizations}
          initialTotalCount={totalCount}
          userId={user.id}
        />
      </div>
    </AuthenticatedLayout>
  );
}
