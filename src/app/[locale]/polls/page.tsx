import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PlusIcon } from '@heroicons/react/20/solid';
import { getUserPollsAction } from '@/web/actions/poll';
import { getUserMemberOrganizationsAction } from '@/web/actions/organization';
import { PollCard } from '@/web/components/PollCard';
import { Toaster } from 'sonner';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

export default async function PollsPage() {
  const t = await getTranslations('poll');
  const user = await getCurrentUser();

  if (!user) {
    return <AuthenticatedLayout>{null}</AuthenticatedLayout>;
  }

  // Check if user is a member of any organization
  const orgsResult = await getUserMemberOrganizationsAction();
  const hasOrgMembership = orgsResult.success && orgsResult.data.length > 0;

  // Fetch user's polls
  const pollsResult = await getUserPollsAction();
  const polls = pollsResult.success ? pollsResult.data : [];

  // Fetch user's admin organizations and superadmin status for authorization
  const adminOrgs = await organizationRepository.findAdminOrganizationsByUserId(
    user.id
  );
  const adminOrgIds = new Set(adminOrgs.map((o) => o.id));
  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  return (
    <AuthenticatedLayout>
      <Toaster />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Heading className="text-3xl font-bold">{t('title')}</Heading>
            <Subheading>{t('myPolls')}</Subheading>
          </div>
          <Link href="/polls/create">
            <Button color="blue" disabled={!hasOrgMembership}>
              <PlusIcon className="w-5 h-5 mr-2" />
              {t('createPoll')}
            </Button>
          </Link>
        </div>

        {/* No org membership warning */}
        {!hasOrgMembership && (
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('noOrgMembership')}
            </p>
          </div>
        )}

        {/* Polls List */}
        {polls.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {t('noPollsYet')}
            </p>
            {hasOrgMembership && (
              <Link href="/polls/create" className="mt-4 inline-block">
                <Button color="blue">
                  <PlusIcon className="w-5 h-5 mr-2" />
                  {t('createPoll')}
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {polls.map((poll: any) => (
              <PollCard
                key={poll.id}
                poll={poll}
                userId={user.id}
                canManage={isSuperAdmin || adminOrgIds.has(poll.organizationId)}
              />
            ))}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
