import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Badge } from '@/app/components/catalyst/badge';
import { Divider } from '@/app/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import {
  getChildOrgJoinParentRequestAction,
  getIncomingJoinParentRequestsAction,
} from '@/web/actions/joinParentRequest';
import { searchPollsAction } from '@/web/actions/poll';
import { JoinOrganizationButton } from './JoinOrganizationButton';
import { CancelJoinParentButton } from './CancelJoinParentButton';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { OrgHierarchyTree } from '@/app/components/OrgHierarchyTree';
import { PollsList } from '@/web/components/PollsList';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id } = await params;
  const t = await getTranslations('organization.detail');
  const tCommon = await getTranslations('common');

  const user = await getCurrentUser();

  // Fetch organization details
  const result = await getOrganizationDetailsAction(id);

  if (!result.success) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">{result.error}</Text>
          <Link href="/organizations" className="mt-4 inline-block">
            <Button color="zinc">{tCommon('back')}</Button>
          </Link>
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

  const tJoinParent = await getTranslations('organization.joinParent');

  // Fetch join parent request data for admins
  let pendingParentRequest: {
    id: string;
    parentOrgId: string;
    parentOrgName: string;
    message: string;
    createdAt: Date;
  } | null = null;
  let incomingParentRequestCount = 0;

  if (isUserAdmin) {
    const [childReqResult, incomingReqResult] = await Promise.all([
      getChildOrgJoinParentRequestAction(id),
      getIncomingJoinParentRequestsAction(id),
    ]);

    if (childReqResult.success) {
      pendingParentRequest = childReqResult.data.request;
    }

    if (incomingReqResult.success) {
      incomingParentRequestCount = incomingReqResult.data.requests.length;
    }
  }

  // Fetch polls data for members/admins
  const organizationRepository = new PrismaOrganizationRepository(prisma);
  const userRepository = new PrismaUserRepository(prisma);

  let pollsData: { polls: any[]; totalCount: number } | null = null;
  let adminOrgIds: string[] = [];
  let isSuperAdmin = false;
  let userMemberOrgIds: string[] = [];

  if (user) {
    const memberOrgs = await organizationRepository.findMembershipsByUserId(user.id);
    userMemberOrgIds = memberOrgs.map((o) => o.id);
  }

  if (user && (isUserMember || isUserAdmin)) {
    isSuperAdmin = await userRepository.isSuperAdmin(user.id);
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
          <Heading className="text-3xl font-bold">{organization.name}</Heading>
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
        <OrgHierarchyTree tree={hierarchyTree} currentOrgId={id} userMemberOrgIds={userMemberOrgIds} />

        {/* Action Buttons for Logged-in Users */}
        {user && !isUserMember && (
          <JoinOrganizationButton organizationId={id} />
        )}

        {isUserAdmin && (
          <div className="space-y-4">
            <div className="flex gap-4 flex-wrap">
              <Link href={`/organizations/${id}/pending-requests`}>
                <Button color="amber">{t('pendingRequests')}</Button>
              </Link>
              <Link href={`/organizations/${id}/boards/manage`}>
                <Button color="brand-green">{t('manageBoards')}</Button>
              </Link>
              <Link href={`/organizations/${id}/join-parent-requests`}>
                <Button color="amber">
                  {tJoinParent('manageRequests')}
                  {incomingParentRequestCount > 0 && (
                    <Badge color="red" className="ml-2">
                      {incomingParentRequestCount}
                    </Badge>
                  )}
                </Button>
              </Link>
            </div>

            {/* Pending Parent Request Status */}
            {pendingParentRequest ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
                <Text className="font-medium text-amber-800 dark:text-amber-200">
                  {tJoinParent('pendingRequestDescription', {
                    parentName: pendingParentRequest.parentOrgName,
                  })}
                </Text>
                <Text className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                  {tJoinParent('requestMessage')}:{' '}
                  {pendingParentRequest.message}
                </Text>
                <div className="mt-3">
                  <CancelJoinParentButton requestId={pendingParentRequest.id} />
                </div>
              </div>
            ) : (
              <Link href={`/organizations/${id}/join-parent`}>
                <Button color="brand-green">{tJoinParent('title')}</Button>
              </Link>
            )}
          </div>
        )}

        {/* Boards Section - Visible to members and admins */}
        {(isUserMember || isUserAdmin) && (
          <>
            <Divider />
            <div>
              <Heading level={2} className="mb-4">
                {t('boards')}
              </Heading>
              {boards.length > 0 ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {boards.map((board) => (
                    <div
                      key={board.id}
                      className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                    >
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <Heading level={3} className="text-lg font-semibold">
                            {board.name}
                          </Heading>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge color="zinc">
                            {t('boardMemberCount', {
                              count: board.memberCount,
                            })}
                          </Badge>
                          {board.isUserMember && (
                            <Badge color="green">{t('boardMember')}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
                  <Text className="text-lg text-zinc-500 dark:text-zinc-400">
                    {t('noBoards')}
                  </Text>
                </div>
              )}
            </div>
          </>
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
