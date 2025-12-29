import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PlusIcon } from '@heroicons/react/20/solid';
import { ClockIcon, CalendarIcon } from '@heroicons/react/24/outline';
import { getUserBoardsAction } from '@/web/actions/board';
import { getUserPollsAction } from '@/web/actions/poll';

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
            {polls.map((poll: any) => {
              const now = new Date();
              const startDate = new Date(poll.startDate);
              const endDate = new Date(poll.endDate);
              const isActive = now >= startDate && now <= endDate;
              const isUpcoming = now < startDate;
              const isFinished = now > endDate;

              return (
                <Link
                  key={poll.id}
                  href={`/polls/${poll.id}`}
                  className="block p-6 bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors"
                >
                  <div className="space-y-4">
                    {/* Title and status */}
                    <div>
                      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                        {poll.title}
                      </h3>
                      <div className="mt-1">
                        {isActive && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 bg-green-50 dark:text-green-400 dark:bg-green-900/20 rounded-full">
                            <ClockIcon className="w-3 h-3" />
                            {t('active')}
                          </span>
                        )}
                        {isUpcoming && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20 rounded-full">
                            <CalendarIcon className="w-3 h-3" />
                            {t('upcoming')}
                          </span>
                        )}
                        {isFinished && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-zinc-500 bg-zinc-50 dark:text-zinc-400 dark:bg-zinc-800 rounded-full">
                            {t('finished')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {poll.description && (
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 line-clamp-2">
                        {poll.description}
                      </p>
                    )}

                    {/* Stats */}
                    <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
                      <span>
                        {t('questionsNumber')}{' '}
                        {poll.questions?.length || 0}{' '}
                      </span>
                      <span>•</span>
                      <span>{endDate.toLocaleDateString()}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
