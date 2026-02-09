import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { getPollByIdAction } from '@/web/actions/poll';
import { getParticipantsAction } from '@/web/actions/participant';
import ParticipantManagement from '@/web/components/participants/ParticipantManagement';
import { Heading } from '@/app/components/catalyst/heading';
import { Toaster } from 'sonner';
import { ParticipantWithUser } from '@/src/application/poll/GetParticipantsUseCase';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';

const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

interface ParticipantsPageProps {
  params: Promise<{
    pollId: string;
    locale: string;
  }>;
}

export default async function ParticipantsPage({
  params,
}: ParticipantsPageProps) {
  const t = await getTranslations('poll.participants');
  const user = await getCurrentUser();
  const { pollId } = await params;

  if (!user) {
    redirect('/auth/login');
  }

  // Get poll details
  const pollResult = await getPollByIdAction(pollId);

  if (!pollResult.success) {
    redirect('/polls');
  }

  const poll = pollResult.data;

  // Fetch user's admin organizations and superadmin status for authorization
  const isOrgAdmin = await organizationRepository.isUserAdmin(
    user.id,
    poll.organizationId
  );
  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);
  const canManage = isSuperAdmin || isOrgAdmin;

  // Check if user is the poll creator
  if (!canManage) {
    redirect(`/polls/${pollId}`);
  }

  // Get participants
  const participantsResult = await getParticipantsAction(pollId);

  if (!participantsResult.success) {
    return (
      <AuthenticatedLayout>
        <div className="mb-8">
          <Heading>{t('title')}</Heading>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900">
          <p className="text-red-600 dark:text-red-400">
            {participantsResult.error}
          </p>
        </div>
      </AuthenticatedLayout>
    );
  }

  const participantsData = participantsResult.data;

  // Serialize participants data for client component
  const serializedParticipants = participantsData.participants.map(
    (p: ParticipantWithUser) => ({
      id: p.participant.id,
      userId: p.participant.userId,
      userName: `${p.user.firstName} ${p.user.lastName}`,
      userPhone: p.user.phoneNumber,
      weight: p.participant.userWeight,
      updatedAt: p.participant.snapshotAt.toISOString(),
    })
  );

  return (
    <AuthenticatedLayout>
      <div className="mb-8">
        <Heading>{t('title')}</Heading>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
      </div>

      <ParticipantManagement
        pollId={pollId}
        participantsData={{
          participants: serializedParticipants,
          canModify: participantsData.canModify,
        }}
        pollState={poll.state}
      />

      <Toaster />
    </AuthenticatedLayout>
  );
}
