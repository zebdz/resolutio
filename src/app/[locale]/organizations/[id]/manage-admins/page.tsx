import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import { Link } from '@/src/i18n/routing';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { CurrentAdminsList } from './CurrentAdminsList';
import { InviteAdminSection } from './InviteAdminSection';
import { PendingAdminInvites } from './PendingAdminInvites';
import { getPendingAdminInvitesAction } from '@/web/actions/invitation';
import {
  getOrganizationDetailsAction,
  getOrgAdminsPaginatedAction,
} from '@/web/actions/organization';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';

const userRepository = new PrismaUserRepository(prisma);

export default async function ManageAdminsPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id: organizationId, locale } = await params;
  const t = await getTranslations('manageAdmins');

  const user = await getCurrentUser();

  if (!user) {
    redirect(`/${locale}/login`);
  }

  const orgResult = await getOrganizationDetailsAction(organizationId);

  if (!orgResult.success) {
    redirect(`/${locale}`);
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  if (!orgResult.data.isUserAdmin && !isSuperAdmin) {
    redirect(`/${locale}/organizations/${organizationId}`);
  }

  const [adminsResult, pendingResult] = await Promise.all([
    getOrgAdminsPaginatedAction(organizationId, 1, 100),
    getPendingAdminInvitesAction(organizationId),
  ]);

  const admins = adminsResult.success ? adminsResult.data.admins : [];
  const pendingInvites = pendingResult.success ? pendingResult.data : [];

  // Resolve invitee user details
  const inviteeUserIds = pendingInvites.map((inv) => inv.inviteeId);
  const inviteeUserDomains =
    inviteeUserIds.length > 0
      ? await userRepository.findByIds(inviteeUserIds)
      : [];
  const inviteeUsers = inviteeUserDomains.map((u) => ({
    id: u.id,
    firstName: u.firstName,
    lastName: u.lastName,
    middleName: u.middleName ?? null,
    nickname: u.nickname.getValue(),
  }));

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/organizations/${organizationId}/modify`}
          className="mb-4 inline-flex items-center text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
        >
          ← {t('back')}
        </Link>

        <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-zinc-100">
          {t('title')}
        </h1>

        <div className="space-y-6">
          <CurrentAdminsList
            organizationId={organizationId}
            admins={admins}
            currentUserId={user.id}
          />
          <InviteAdminSection organizationId={organizationId} />
          <PendingAdminInvites
            organizationId={organizationId}
            initialInvites={pendingInvites}
            inviteeUsers={inviteeUsers}
          />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
