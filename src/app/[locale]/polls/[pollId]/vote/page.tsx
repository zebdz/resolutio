import { getTranslations } from 'next-intl/server';
import {
  getUserVotingProgressAction,
  canUserVoteAction,
} from '@/web/actions/vote';
import VotingInterface from '@/web/components/voting/VotingInterface';
import { Heading } from '@/app/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { Toaster } from 'sonner';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

interface VotePageProps {
  params: Promise<{
    pollId: string;
    locale: string;
  }>;
}

export default async function VotePage({ params }: VotePageProps) {
  const { pollId } = await params;
  const commonT = await getTranslations('common');

  // Check if user can vote
  const canVoteResult = await canUserVoteAction(pollId);

  if (!canVoteResult.success) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            {canVoteResult.error}
          </p>
        </div>
        <div className="mt-4">
          <Link href="/polls">
            <Button color="zinc" className="inline-flex items-center">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {commonT('back')}
            </Button>
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!canVoteResult.data.canVote) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {canVoteResult.data.reason}
          </p>
        </div>
        <div className="mt-4">
          <Link href="/polls">
            <Button color="zinc" className="inline-flex items-center">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {commonT('back')}
            </Button>
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Get voting progress
  const progressResult = await getUserVotingProgressAction(pollId);

  if (!progressResult.success) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            {progressResult.error}
          </p>
        </div>
        <div className="mt-4">
          <Link href="/polls">
            <Button color="zinc" className="inline-flex items-center">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {commonT('back')}
            </Button>
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  const { poll, drafts } = progressResult.data;

  // Serialize poll data to plain objects for client component
  const serializedPoll = {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    questions: poll.questions.map((q: any) => ({
      id: q.id,
      text: q.text,
      details: q.details,
      page: q.page,
      order: q.order,
      questionType: q.questionType,
      answers: q.answers.map((a: any) => ({
        id: a.id,
        text: a.text,
        order: a.order,
      })),
    })),
  };

  const serializedDrafts = drafts.map((d: any) => ({
    id: d.id,
    questionId: d.questionId,
    answerId: d.answerId,
  }));

  return (
    <AuthenticatedLayout>
      <div className="mb-6">
        <Heading>{serializedPoll.title}</Heading>
        {serializedPoll.description && (
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">
            {serializedPoll.description}
          </p>
        )}
      </div>

      <VotingInterface
        poll={serializedPoll}
        userDrafts={serializedDrafts}
        pollId={pollId}
      />

      <Toaster />
    </AuthenticatedLayout>
  );
}
