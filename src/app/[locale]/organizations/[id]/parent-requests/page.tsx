import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import { getIncomingJoinParentRequestsAction } from '@/web/actions/joinParentRequest';
import { Button } from '@/app/components/catalyst/button';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { ParentRequestsList } from './ParentRequestsList';

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function IncomingParentRequestsPage({
  params,
}: PageProps) {
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

  // Fetch incoming requests
  const requestsResult =
    await getIncomingJoinParentRequestsAction(organizationId);

  const requests = requestsResult.success ? requestsResult.data.requests : [];

  const { organization } = detailsResult.data;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <Link href={`/organizations/${organizationId}`}>
            <Button color="zinc">{tCommon('back')}</Button>
          </Link>
        </div>

        <div className="mb-8">
          <Heading>{t('incomingRequests')}</Heading>
          <Subheading className="mt-2">{organization.name}</Subheading>
        </div>

        <ParentRequestsList requests={requests} />
      </div>
    </AuthenticatedLayout>
  );
}
