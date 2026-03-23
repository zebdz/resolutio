import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getOrganizationDetailsAction } from '@/src/web/actions/organization/organization';
import { getChildOrgJoinParentRequestAction } from '@/src/web/actions/organization/joinParentRequest';
import { Heading, Subheading } from '@/src/web/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { JoinParentForm } from './JoinParentForm';
import { prisma, PrismaOrganizationRepository } from '@/infrastructure/index';

const organizationRepository = new PrismaOrganizationRepository(prisma);

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function JoinParentPage({ params }: PageProps) {
  const { id: organizationId, locale } = await params;
  const t = await getTranslations('organization.joinParent');
  const tCommon = await getTranslations('common');

  // Verify org exists and user is admin
  const detailsResult = await getOrganizationDetailsAction(organizationId);

  if (!detailsResult.success) {
    notFound();
  }

  if (!detailsResult.data.isUserAdmin) {
    redirect(`/${locale}/organizations/${organizationId}`);
  }

  // Check if already has pending request
  const pendingResult =
    await getChildOrgJoinParentRequestAction(organizationId);

  if (pendingResult.success && pendingResult.data.request) {
    redirect(`/${locale}/organizations/${organizationId}`);
  }

  // Build excludeIds: self + descendants
  const descendantIds =
    await organizationRepository.getDescendantIds(organizationId);
  const excludeIds = [organizationId, ...descendantIds];

  const { organization } = detailsResult.data;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <Link
          href={`/organizations/${organizationId}/modify`}
          className="mb-4 inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          {tCommon('backToManagement')}
        </Link>

        <div className="mb-8">
          <Heading>{t('title')}</Heading>
          <Subheading className="mt-2">
            {t('subtitle', { organization: organization.name })}
          </Subheading>
        </div>

        <JoinParentForm childOrgId={organizationId} excludeIds={excludeIds} />
      </div>
    </AuthenticatedLayout>
  );
}
