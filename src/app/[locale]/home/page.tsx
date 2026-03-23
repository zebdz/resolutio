import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { CreateOrganizationButton } from './CreateOrganizationButton';
import { UserOrganizationsList } from './UserOrganizationsList';
import { getAdminOrganizationsAction } from '@/web/actions/organization';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { PendingInvitesSection } from './PendingInvitesSection';
import { PendingJoinRequestsSection } from './PendingJoinRequestsSection';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('home');

  // Check if user is admin of any organization
  const adminOrgsResult = await getAdminOrganizationsAction();
  const adminOrganizations = adminOrgsResult.success
    ? adminOrgsResult.data.organizations
    : [];
  const isAdmin = adminOrganizations.length > 0;

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Heading className="text-3xl font-bold">{t('title')}</Heading>
        </div>

        {/* Create Organization Button */}
        <div className="flex flex-wrap gap-4">
          <CreateOrganizationButton locale={locale} />
          {isAdmin && (
            <Link href="/organizations/pending-requests">
              <Button color="amber">{t('managePendingRequests')}</Button>
            </Link>
          )}
        </div>

        {/* User Organizations List */}
        <UserOrganizationsList adminOrganizations={adminOrganizations} />

        {/* Pending Join Requests */}
        <PendingJoinRequestsSection />

        {/* Pending Invitations */}
        <PendingInvitesSection />
      </div>
    </AuthenticatedLayout>
  );
}
