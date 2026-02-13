import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import { listOrganizationsAction } from '@/web/actions/organization';
import { getChildOrgJoinParentRequestAction } from '@/web/actions/joinParentRequest';
import { Button } from '@/app/components/catalyst/button';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
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

  // Get all orgs and exclude self + descendants
  const [orgsResult, descendantIds] = await Promise.all([
    listOrganizationsAction(),
    organizationRepository.getDescendantIds(organizationId),
  ]);

  const excludeIds = new Set([organizationId, ...descendantIds]);

  const availableOrgs = orgsResult.success
    ? orgsResult.data.organizations
        .filter((org) => !excludeIds.has(org.id))
        .map((org) => ({ id: org.id, name: org.name }))
    : [];

  const { organization } = detailsResult.data;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8">
          <Link href={`/organizations/${organizationId}`}>
            <Button color="zinc">{tCommon('back')}</Button>
          </Link>
        </div>

        <div className="mb-8">
          <Heading>{t('title')}</Heading>
          <Subheading className="mt-2">
            {t('subtitle', { organization: organization.name })}
          </Subheading>
        </div>

        <JoinParentForm
          childOrgId={organizationId}
          availableOrgs={availableOrgs}
        />
      </div>
    </AuthenticatedLayout>
  );
}
