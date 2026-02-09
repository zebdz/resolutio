import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PlusIcon } from '@heroicons/react/20/solid';
import { searchPollsAction } from '@/web/actions/poll';
import { getUserMemberOrganizationsAction } from '@/web/actions/organization';
import { Toaster } from 'sonner';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { PollsList } from '@/web/components/PollsList';

const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

export default async function PollsPage() {
  const t = await getTranslations('poll');
  const user = await getCurrentUser();

  if (!user) {
    return <AuthenticatedLayout>{null}</AuthenticatedLayout>;
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  // Admin org IDs for canManage
  const adminOrgs = await organizationRepository.findAdminOrganizationsByUserId(
    user.id
  );
  const adminOrgIds = adminOrgs.map((o) => o.id);

  // Org list for dropdown: superadmin sees all, regular user sees member + admin orgs
  let organizations: Array<{ id: string; name: string }> = [];

  if (isSuperAdmin) {
    const allOrgs = await organizationRepository.findAllWithStats();
    organizations = allOrgs.map((o) => ({
      id: o.organization.id,
      name: o.organization.name,
    }));
  } else {
    const orgsResult = await getUserMemberOrganizationsAction();
    const memberOrgs = orgsResult.success ? orgsResult.data : [];

    // Merge admin orgs that aren't already in member list
    const orgMap = new Map(memberOrgs.map((o) => [o.id, o]));

    for (const adminOrg of adminOrgs) {
      if (!orgMap.has(adminOrg.id)) {
        orgMap.set(adminOrg.id, { id: adminOrg.id, name: adminOrg.name });
      }
    }

    organizations = [...orgMap.values()];
  }

  const hasOrgMembership = organizations.length > 0;

  // Initial polls: last week
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const pollsResult = await searchPollsAction({
    createdFrom: oneWeekAgo.toISOString().split('T')[0],
  });
  const polls = pollsResult.success ? pollsResult.data : [];

  return (
    <AuthenticatedLayout>
      <Toaster />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Heading className="text-3xl font-bold">
              {isSuperAdmin ? t('allPolls') : t('title')}
            </Heading>
            <Subheading>{isSuperAdmin ? t('title') : t('myPolls')}</Subheading>
          </div>
          <Link href="/polls/create">
            <Button color="blue" disabled={!hasOrgMembership}>
              <PlusIcon className="h-5 w-5 mr-2" />
              {t('createPoll')}
            </Button>
          </Link>
        </div>

        {/* No org membership warning */}
        {!hasOrgMembership && !isSuperAdmin && (
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('noOrgMembership')}
            </p>
          </div>
        )}

        <PollsList
          initialPolls={polls}
          organizations={organizations}
          userId={user.id}
          adminOrgIds={adminOrgIds}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </AuthenticatedLayout>
  );
}
