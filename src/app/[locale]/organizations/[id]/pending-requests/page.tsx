import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getPendingRequestsAction,
  getOrganizationDetailsAction,
} from '@/web/actions/organization';
import { Button } from '@/app/components/catalyst/button';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { PendingRequestsList } from '@/app/[locale]/organizations/pending-requests/PendingRequestsList';

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function OrganizationPendingRequestsPage({
  params,
}: PageProps) {
  const { id: organizationId, locale } = await params;
  const t = await getTranslations('organization.pendingRequestsPage');
  const tCommon = await getTranslations('common');

  // Get organization details to verify access and get organization name
  const detailsResult = await getOrganizationDetailsAction(organizationId);

  if (!detailsResult.success) {
    notFound();
  }

  // Only admins can view pending requests
  if (!detailsResult.data.isUserAdmin) {
    redirect(`/${locale}/organizations/${organizationId}`);
  }

  // Get all pending requests for organizations where user is admin
  const requestsResult = await getPendingRequestsAction();

  if (!requestsResult.success) {
    notFound();
  }

  // Filter requests for this specific organization
  const filteredRequests = requestsResult.data.requests.filter(
    (req) => req.organizationId === organizationId
  );

  const { organization } = detailsResult.data;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="mb-8 flex items-center justify-between">
        <Link
          href={`/organizations/${organizationId}`}
          className="text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          <Button color="zinc">{tCommon('back')}</Button>
        </Link>
      </div>

      <div className="mb-8">
        <Heading>{t('title')}</Heading>
        <Subheading className="mt-2">
          {t('subtitle', { organization: organization.name })}
        </Subheading>
      </div>

      <PendingRequestsList requests={filteredRequests} />
    </div>
  );
}
