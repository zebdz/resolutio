import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { redirect } from 'next/navigation';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import { SuperadminOrganizationsList } from './SuperadminOrganizationsList';
import { searchAllOrganizationsAction } from '@/web/actions/organization';

const PAGE_SIZE = 30;

export default async function SuperadminOrganizationsPage() {
  const t = await getTranslations('superadmin.organizations');
  const tHub = await getTranslations('superadmin.hub');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const result = await searchAllOrganizationsAction({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const organizations = result.success ? result.data.organizations : [];
  const totalCount = result.success ? result.data.totalCount : 0;

  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Link
          href="/superadmin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; {tHub('back')}
        </Link>
        <Heading level={2} className="text-xl font-semibold">
          {t('title')}
        </Heading>
        <Text className="text-zinc-600 dark:text-zinc-400">
          {t('subtitle')}
        </Text>
      </div>

      <SuperadminOrganizationsList
        initialOrganizations={organizations}
        initialTotalCount={totalCount}
        userId={user.id}
      />
    </div>
  );
}
