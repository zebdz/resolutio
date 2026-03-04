import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { SuperadminOrganizationsList } from './SuperadminOrganizationsList';
import { searchAllOrganizationsAction } from '@/web/actions/organization';

const PAGE_SIZE = 30;
const userRepository = new PrismaUserRepository(prisma);

export default async function SuperadminPage() {
  const t = await getTranslations('superadmin');
  const tOrgs = await getTranslations('superadmin.organizations');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  if (!isSuperAdmin) {
    redirect('/home');
  }

  const result = await searchAllOrganizationsAction({
    page: 1,
    pageSize: PAGE_SIZE,
  });

  const organizations = result.success ? result.data.organizations : [];
  const totalCount = result.success ? result.data.totalCount : 0;

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <Heading className="text-3xl font-bold">{t('title')}</Heading>
        </div>

        <div className="space-y-4">
          <div className="space-y-1">
            <Heading level={2} className="text-xl font-semibold">
              {tOrgs('title')}
            </Heading>
            <Text className="text-zinc-600 dark:text-zinc-400">
              {tOrgs('subtitle')}
            </Text>
          </div>

          <SuperadminOrganizationsList
            initialOrganizations={organizations}
            initialTotalCount={totalCount}
            userId={user.id}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
