import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import { getAllJoinParentRequestsAction } from '@/web/actions/joinParentRequest';
import { Button } from '@/app/components/catalyst/button';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { IncomingRequestsTable } from './IncomingRequestsTable';
import { OutgoingRequestsTable } from './OutgoingRequestsTable';

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function JoinParentRequestsPage({ params }: PageProps) {
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

  const requestsResult = await getAllJoinParentRequestsAction(organizationId);

  const incoming = requestsResult.success ? requestsResult.data.incoming : [];
  const outgoing = requestsResult.success ? requestsResult.data.outgoing : [];

  const { organization } = detailsResult.data;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8">
          <Link href={`/organizations/${organizationId}`}>
            <Button color="zinc">{tCommon('back')}</Button>
          </Link>
        </div>

        <div className="mb-8">
          <Heading>{t('managementTitle')}</Heading>
          <Subheading className="mt-2">{organization.name}</Subheading>
        </div>

        <div className="space-y-10">
          <section>
            <Heading level={2} className="mb-4">
              {t('incomingSection')}
            </Heading>
            <IncomingRequestsTable requests={incoming} />
          </section>

          <section>
            <Heading level={2} className="mb-4">
              {t('outgoingSection')}
            </Heading>
            <OutgoingRequestsTable requests={outgoing} />
          </section>
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
