import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getBoardDetailsAction } from '@/web/actions/board';
import { getPendingBoardInvitesAction } from '@/web/actions/invitation';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { User } from '@/domain/user/User';
import InviteMemberSection from './InviteMemberSection';
import InviteOutsideMemberSection from './InviteOutsideMemberSection';
import MembersList from './MembersList';
import PendingBoardInvites from './PendingBoardInvites';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';

const userRepository = new PrismaUserRepository(prisma);

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
    boardId: string;
  }>;
};

export default async function ManageSingleBoardPage({ params }: PageProps) {
  const { id: organizationId, boardId } = await params;
  const t = await getTranslations('organization.boards.manageSingle');
  const tCommon = await getTranslations('common');

  // Get board details
  const result = await getBoardDetailsAction(boardId);

  if (!result.success) {
    notFound();
  }

  const { board, members, organizationMembers } = result.data;

  // Filter out users who are already members
  const availableUsers = organizationMembers.filter(
    (om) => !members.some((m) => m.id === om.id)
  );

  // Fetch pending board invites and resolve invitee names
  const invitesResult = await getPendingBoardInvitesAction(boardId);
  const rawInvites = invitesResult.success ? invitesResult.data : [];

  const inviteeIds = rawInvites.map((inv) => inv.inviteeId);
  const inviteeUserDomains =
    inviteeIds.length > 0 ? await userRepository.findByIds(inviteeIds) : [];
  const inviteeMap = new Map(
    inviteeUserDomains.map((u) => [
      u.id,
      User.formatFullName(u.firstName, u.lastName, u.middleName),
    ])
  );

  const pendingInvites = rawInvites.map((inv) => ({
    id: inv.id,
    inviteeName: inviteeMap.get(inv.inviteeId) || inv.inviteeId,
  }));

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Heading>{t('title')}</Heading>
            <Subheading className="mt-2">
              {t('subtitle', { board: board.name })}
            </Subheading>
          </div>
          <div className="flex gap-2">
            <Link href={`/organizations/${organizationId}/boards/manage`}>
              <Button color="zinc">{tCommon('back')}</Button>
            </Link>
          </div>
        </div>

        {/* Invite Member Section */}
        <div className="mb-8">
          <InviteMemberSection
            boardId={boardId}
            availableUsers={availableUsers}
          />
        </div>

        {/* Invite Outside Member Section */}
        <div className="mb-8">
          <InviteOutsideMemberSection boardId={boardId} />
        </div>

        {/* Pending Invitations */}
        {pendingInvites.length > 0 && (
          <div className="mb-8">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
              {t('pendingInvites')}
            </h3>
            <PendingBoardInvites invites={pendingInvites} />
          </div>
        )}

        {/* Members List */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            {t('members')}
          </h3>
          <MembersList boardId={boardId} members={members} />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
