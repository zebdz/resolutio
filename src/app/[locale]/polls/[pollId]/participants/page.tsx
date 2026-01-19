import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { getPollByIdAction } from '@/web/actions/poll';
import { getParticipantsAction } from '@/web/actions/participant';
import ParticipantManagement from '@/web/components/participants/ParticipantManagement';
import { Heading } from '@/app/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { Toaster } from 'sonner';
import { ParticipantWithUser } from '@/src/application/poll/GetParticipantsUseCase';

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
  const commonT = await getTranslations('common');
  const user = await getCurrentUser();
  const { pollId, locale } = await params;

  if (!user) {
    redirect('/auth/login');
  }

  // Get poll details
  const pollResult = await getPollByIdAction(pollId);

  if (!pollResult.success) {
    redirect('/polls');
  }

  const poll = pollResult.data;

  // Check if user is the poll creator
  if (poll.createdBy !== user.id) {
    redirect(`/polls/${pollId}`);
  }

  // Get participants
  const participantsResult = await getParticipantsAction(pollId);

  if (!participantsResult.success) {
    return (
      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <Link href={`/polls/${pollId}/edit`}>
            <Button color="zinc" className="inline-flex items-center mb-4">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {commonT('back')}
            </Button>
          </Link>
          <Heading>{t('title')}</Heading>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900">
          <p className="text-red-600 dark:text-red-400">
            {participantsResult.error}
          </p>
        </div>
      </main>
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
    <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        {/* <Link href={`/polls/${pollId}/edit`}> */}
        <Link href={`/polls`}>
          <Button color="zinc" className="inline-flex items-center mb-4">
            <ArrowLeftIcon className="w-4 h-4 mr-2" />
            {commonT('back')}
          </Button>
        </Link>
        <Heading>{t('title')}</Heading>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
      </div>

      <ParticipantManagement
        pollId={pollId}
        participantsData={{
          participants: serializedParticipants,
          canModify: participantsData.canModify,
        }}
        isActive={poll.isActive}
        isFinished={poll.isFinished}
      />

      <Toaster />
    </main>
  );
}
