import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { getJoinTokensByOrgAction } from '@/web/actions/joinToken';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { ManageTokensClient } from './ManageTokensClient';

const userRepository = new PrismaUserRepository(prisma);

export default async function ManageTokensPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations('joinToken.manage');
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  // Check admin/superadmin
  const [orgResult, isSuperAdmin] = await Promise.all([
    getOrganizationDetailsAction(id),
    userRepository.isSuperAdmin(user.id),
  ]);

  const isUserAdmin = orgResult.success ? orgResult.data.isUserAdmin : false;

  if (!isUserAdmin && !isSuperAdmin) {
    redirect(`/${locale}/organizations/${id}`);
  }

  // Default: show only active tokens
  const tokensResult = await getJoinTokensByOrgAction(
    id,
    undefined,
    undefined,
    undefined,
    true
  );

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        <div className="space-y-2">
          <Link
            href={`/organizations/${id}/modify`}
            className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {t('backToModify')}
          </Link>
          <Heading className="text-3xl font-bold">{t('title')}</Heading>
        </div>

        <ManageTokensClient
          organizationId={id}
          initialTokens={tokensResult.success ? tokensResult.data.tokens : []}
          initialTotalCount={
            tokensResult.success ? tokensResult.data.totalCount : 0
          }
        />
      </div>
    </AuthenticatedLayout>
  );
}
