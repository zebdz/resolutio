import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getOrganizationDetailsAction } from '@/src/web/actions/organization/organization';
import { listPendingClaimsForOrgAction } from '@/src/web/actions/organization/propertyClaim';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { Heading } from '@/src/web/components/catalyst/heading';
import { ClaimsQueue } from './ClaimsQueue';

const userRepository = new PrismaUserRepository(prisma);

export default async function PropertyClaimsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations('propertyClaim.admin');
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const orgRes = await getOrganizationDetailsAction(id);

  if (!orgRes.success) {
    redirect(`/${locale}`);
  }

  const isSuper = await userRepository.isSuperAdmin(user.id);

  if (!orgRes.data.isUserAdmin && !isSuper) {
    redirect(`/${locale}/organizations/${id}`);
  }

  const r = await listPendingClaimsForOrgAction({ organizationId: id });
  const rows = r.success ? r.data.rows : [];

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Link
          href={`/organizations/${id}/modify`}
          className="inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          ← {t('back')}
        </Link>
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        <ClaimsQueue initialRows={rows} />
      </div>
    </AuthenticatedLayout>
  );
}
