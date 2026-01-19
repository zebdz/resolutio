import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PlusIcon } from '@heroicons/react/20/solid';
import { getUserBoardsAction } from '@/web/actions/board';
import { getUserPollsAction } from '@/web/actions/poll';
import { PollCard } from '@/web/components/PollCard';
import { Toaster } from 'sonner';

export default async function PollsPage() {
  const t = await getTranslations('poll');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Check if user is a member of any boards
  const boardsResult = await getUserBoardsAction();
  const userBoards = boardsResult.success ? boardsResult.data : [];
  const hasBoardMembership = userBoards.length > 0;

  // Fetch user's polls
  const pollsResult = await getUserPollsAction();
  const polls = pollsResult.success ? pollsResult.data : [];

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <Toaster />
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Heading className="text-3xl font-bold">{t('title')}</Heading>
            <Subheading>{t('myPolls')}</Subheading>
          </div>
          <Link href="/polls/create">
            <Button color="blue" disabled={!hasBoardMembership}>
              <PlusIcon className="w-5 h-5 mr-2" />
              {t('createPoll')}
            </Button>
          </Link>
        </div>

        {/* No board membership warning */}
        {!hasBoardMembership && (
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('noBoardMembership')}
            </p>
          </div>
        )}

        {/* Polls List */}
        {polls.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-zinc-500 dark:text-zinc-400">
              {t('noPollsYet')}
            </p>
            {hasBoardMembership && (
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
              <PollCard key={poll.id} poll={poll} userId={user.id} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
