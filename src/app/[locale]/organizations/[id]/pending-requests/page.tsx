import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import {
  getOrganizationPendingRequestsAction,
  getOrganizationDetailsAction,
} from '@/src/web/actions/organization/organization';
import { Heading, Subheading } from '@/src/web/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { OrgPendingRequestsList } from './OrgPendingRequestsList';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
  searchParams: Promise<{ page?: string; pageSize?: string }>;
};

export default async function OrganizationPendingRequestsPage({
  params,
  searchParams,
}: PageProps) {
  const { id: organizationId, locale } = await params;
  const sp = await searchParams;

  const page = Math.max(1, parseInt(sp.page ?? '1', 10) || 1);
  const pageSize = PAGE_SIZE_OPTIONS.includes(Number(sp.pageSize))
    ? Number(sp.pageSize)
    : DEFAULT_PAGE_SIZE;
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

  // Get pending requests for this specific organization
  const requestsResult = await getOrganizationPendingRequestsAction(
    organizationId,
    page,
    pageSize
  );

  if (!requestsResult.success) {
    notFound();
  }

  const { organization } = detailsResult.data;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-4xl px-4 py-8">
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

        <OrgPendingRequestsList
          organizationId={organizationId}
          organizationName={organization.name}
          requests={requestsResult.data.requests}
          totalCount={requestsResult.data.totalCount}
          currentPage={page}
          pageSize={pageSize}
        />
      </div>
    </AuthenticatedLayout>
  );
}
