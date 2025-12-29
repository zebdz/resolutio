import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { CreateOrganizationButton } from './CreateOrganizationButton';
import { UserOrganizationsList } from './UserOrganizationsList';
import { getAdminOrganizationsAction } from '@/web/actions/organization';

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations('home');
  const tAccount = await getTranslations('account');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is admin of any organization
  const adminOrgsResult = await getAdminOrganizationsAction();
  const isAdmin =
    adminOrgsResult.success && adminOrgsResult.data.organizations.length > 0;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Heading className="text-3xl font-bold">{t('title')}</Heading>
          </div>
          <Link href="/account">
            <Button color="zinc">{tAccount('button')}</Button>
          </Link>
        </div>

        {/* Create Organization Button */}
        <div className="flex gap-4">
          <CreateOrganizationButton locale={locale} />
          <Link href="/organizations">
            <Button color="zinc">{t('browseOrganizations')}</Button>
          </Link>
          <Link href="/polls">
            <Button color="blue">{t('viewPolls')}</Button>
          </Link>
          {isAdmin && (
            <Link href="/organizations/pending-requests">
              <Button color="amber">{t('managePendingRequests')}</Button>
            </Link>
          )}
        </div>

        {/* User Organizations List */}
        <UserOrganizationsList />
      </div>
    </main>
  );
}
