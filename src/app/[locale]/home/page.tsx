import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { CreateOrganizationButton } from './CreateOrganizationButton';
import { UserOrganizationsList } from './UserOrganizationsList';
import { getAdminOrganizationsAction } from '@/web/actions/organization';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

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
      </div>
    </AuthenticatedLayout>
  );
}
