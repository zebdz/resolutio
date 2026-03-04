import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Divider } from '@/app/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import {
  getOrganizationDetailsAction,
  getOrgAdminsAction,
  getOrganizationPendingRequestsAction,
} from '@/web/actions/organization';
import {
  getChildOrgJoinParentRequestAction,
  getIncomingJoinParentRequestsAction,
} from '@/web/actions/joinParentRequest';
import { MembershipSection } from '../MembershipSection';
import { ParentOrgSection } from '../ParentOrgSection';
import { BoardsSection } from '../BoardsSection';
import { OrgEditForm } from './OrgEditForm';
import { AdminManagementSection } from './AdminManagementSection';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';

const userRepository = new PrismaUserRepository(prisma);

export default async function OrganizationModifyPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations('organization.modify');
  const tCommon = await getTranslations('common');
  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/auth/login`);
  }

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

  const { organization, boards, isUserAdmin, isUserMember } = result.data;

  // Check if user is admin or superadmin
  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  if (!isUserAdmin && !isSuperAdmin) {
    redirect(`/${locale}/organizations/${id}`);
  }

  // Fetch admins
  const adminsResult = await getOrgAdminsAction(id);
  const admins = adminsResult.success ? adminsResult.data : [];

  // Fetch join parent request data
  let pendingParentRequest: {
    id: string;
    parentOrgId: string;
    parentOrgName: string;
    message: string;
    createdAt: Date;
  } | null = null;
  let incomingParentRequestCount = 0;

  const [childReqResult, incomingReqResult, pendingMembersResult] =
    await Promise.all([
      getChildOrgJoinParentRequestAction(id),
      getIncomingJoinParentRequestsAction(id),
      getOrganizationPendingRequestsAction(id, 1, 1),
    ]);

  if (childReqResult.success) {
    pendingParentRequest = childReqResult.data.request;
  }

  if (incomingReqResult.success) {
    incomingParentRequestCount = incomingReqResult.data.requests.length;
  }

  const pendingMemberRequestCount = pendingMembersResult.success
    ? pendingMembersResult.data.totalCount
    : 0;

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <Link
            href={`/organizations/${id}`}
            className="inline-block text-sm text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
          >
            {tCommon('backToOrganization')}
          </Link>
          <Heading className="text-3xl font-bold">{t('title')}</Heading>
        </div>

        {/* Edit Form */}
        <OrgEditForm
          organizationId={id}
          currentName={organization.name}
          currentDescription={organization.description}
        />

        <Divider />

        {/* Admin Management */}
        <AdminManagementSection
          organizationId={id}
          admins={admins}
          currentUserId={user.id}
        />

        <Divider />

        {/* Membership Section */}
        <MembershipSection
          organizationId={id}
          isUserMember={isUserMember}
          showMemberRequests={isUserAdmin || isSuperAdmin}
          pendingMemberRequestCount={pendingMemberRequestCount}
        />

        {/* Parent Org Section */}
        <ParentOrgSection
          organizationId={id}
          pendingParentRequest={pendingParentRequest}
          incomingParentRequestCount={incomingParentRequestCount}
        />

        <Divider />

        {/* Boards Section */}
        <BoardsSection
          organizationId={id}
          boards={boards}
          showManageBoards={isUserAdmin || isSuperAdmin}
        />
      </div>
    </AuthenticatedLayout>
  );
}
