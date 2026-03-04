import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Divider } from '@/app/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import { searchPollsAction } from '@/web/actions/poll';
import { MembershipSection } from './MembershipSection';
import { BoardsSection } from './BoardsSection';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { OrgHierarchyTree } from '@/app/components/OrgHierarchyTree';
import { PollsList } from '@/web/components/PollsList';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';

const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations('organization.detail');

  const user = await getCurrentUser();

  // Fetch organization details
  const result = await getOrganizationDetailsAction(id);

  if (!result.success) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">{result.error}</Text>
        </div>
      </AuthenticatedLayout>
    );
  }

  const {
    organization,
    boards,
    isUserMember,
    isUserAdmin,
    firstAdmin,
    hierarchyTree,
  } = result.data;

  // Fetch user data
  let pollsData: { polls: any[]; totalCount: number } | null = null;
  let adminOrgIds: string[] = [];
  let isSuperAdmin = false;
  let userMemberOrgIds: string[] = [];

  if (user) {
    const [memberOrgs, superAdmin] = await Promise.all([
      organizationRepository.findMembershipsByUserId(user.id),
      userRepository.isSuperAdmin(user.id),
    ]);
    userMemberOrgIds = memberOrgs.map((o) => o.id);
    isSuperAdmin = superAdmin;
  }

  if (user && (isUserMember || isUserAdmin)) {
    const adminOrgs =
      await organizationRepository.findAdminOrganizationsByUserId(user.id);
    adminOrgIds = adminOrgs.map((o) => o.id);

    const pollsResult = await searchPollsAction({
      organizationId: id,
      page: 1,
      pageSize: 10,
    });

    if (pollsResult.success) {
      pollsData = pollsResult.data;
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Heading className="text-3xl font-bold">
              {organization.name}
            </Heading>
            {(isUserAdmin || isSuperAdmin) && (
              <Link href={`/organizations/${id}/modify`}>
                <Button color="zinc">{t('modifyButton')}</Button>
              </Link>
            )}
          </div>
          {firstAdmin && (
            <Text className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('firstAdmin')}: {firstAdmin.firstName} {firstAdmin.lastName}
            </Text>
          )}
        </div>

        {/* Description */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <Heading level={2} className="mb-4">
            {t('description')}
          </Heading>
          <Text className="text-zinc-700 dark:text-zinc-300">
            {organization.description}
          </Text>
        </div>

        {/* Hierarchy Tree */}
        <OrgHierarchyTree
          tree={hierarchyTree}
          currentOrgId={id}
          userMemberOrgIds={userMemberOrgIds}
        />

        <MembershipSection
          organizationId={id}
          isUserMember={isUserMember}
          showMemberRequests={false}
        />

        {/* Boards Section - Visible to members, admins and superadmins */}
        {(isUserMember || isUserAdmin || isSuperAdmin) && (
          <BoardsSection
            organizationId={id}
            boards={boards}
            showManageBoards={false}
          />
        )}

        {/* Polls Section - Visible to members and admins */}
        {(isUserMember || isUserAdmin) && pollsData && (
          <>
            <Divider />
            <div>
              <Heading level={2} className="mb-4">
                {t('recentPolls')}
              </Heading>
              <PollsList
                initialPolls={pollsData.polls}
                initialTotalCount={pollsData.totalCount}
                userId={user!.id}
                adminOrgIds={adminOrgIds}
                isSuperAdmin={isSuperAdmin}
                fixedOrganizationId={id}
                initialBoards={boards.map((b) => ({ id: b.id, name: b.name }))}
              />
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
