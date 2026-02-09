import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { getPollResultsAction } from '@/web/actions/vote';
import { getPollByIdAction } from '@/web/actions/poll';
import PollResults from '@/web/components/results/PollResults';
import { Heading } from '@/app/components/catalyst/heading';
import {
  AnswerResult,
  QuestionResult,
} from '@/src/application/poll/GetPollResultsUseCase';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

interface ResultsPageProps {
  params: Promise<{
    pollId: string;
    locale: string;
  }>;
}

export default async function ResultsPage({ params }: ResultsPageProps) {
  const { pollId } = await params;
  const t = await getTranslations('poll.results');
  const user = await getCurrentUser();

  if (!user) {
    return <AuthenticatedLayout>{null}</AuthenticatedLayout>;
  }

  // Get poll details
  const pollResult = await getPollByIdAction(pollId);

  if (!pollResult.success) {
    redirect('/polls');
  }

  const poll = pollResult.data;

  // Get results
  const resultsResult = await getPollResultsAction(pollId);

  if (!resultsResult.success) {
    return (
      <AuthenticatedLayout>
        <div className="mb-8">
          <Heading>{t('title')}</Heading>
          <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
        </div>

        <div className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-6 bg-white dark:bg-zinc-900">
          <p className="text-red-600 dark:text-red-400">
            {resultsResult.error}
          </p>
        </div>
      </AuthenticatedLayout>
    );
  }

  const results = resultsResult.data;
  const isPollCreator = poll.createdBy === user.id;

  // IMPORTANT: Only send voter data to client if user has permission to view it
  // This prevents unauthorized access to sensitive voting data via browser console
  const canViewVoters = results.canViewVoters;

  // Serialize results data for client component
  const serializedResults = {
    pollId: results.poll.id,
    totalParticipants: results.totalParticipants,
    totalWeight: results.totalParticipantWeight,
    votedParticipants: results.results.reduce(
      (count: number, question: QuestionResult) => {
        const uniqueVoters = new Set(
          question.answers.flatMap((a: AnswerResult) =>
            a.voters.map((v) => v.userId)
          )
        );

        return Math.max(count, uniqueVoters.size);
      },
      0
    ),
    questions: results.results.map((q: any) => ({
      questionId: q.questionId,
      questionText: q.questionText,
      questionType: q.questionType,
      totalVotes: q.totalVotes,
      totalWeight: q.answers.reduce(
        (sum: number, a: any) => sum + a.totalWeight,
        0
      ),
      answers: q.answers.map((a: any) => ({
        answerId: a.answerId,
        answerText: a.answerText,
        voteCount: a.voteCount,
        weightedVotes: a.totalWeight,
        percentage: a.percentage,
        // SECURITY: Only include voter details if user has permission
        voters: canViewVoters
          ? a.voters.map((v: any) => ({
              userId: v.userId,
              userName: `${v.userName.firstName} ${v.userName.lastName}`,
              weight:
                typeof v.weight === 'object' ? Number(v.weight) : v.weight,
            }))
          : [], // Empty array if user doesn't have permission
      })),
    })),
  };

  return (
    <AuthenticatedLayout>
      <div className="mb-8">
        <Heading>{t('title')}</Heading>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
        {poll.description && (
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            {poll.description}
          </p>
        )}
      </div>

      <PollResults
        results={serializedResults}
        pollState={poll.state}
        isPollCreator={isPollCreator}
        canViewVoters={canViewVoters}
      />
    </AuthenticatedLayout>
  );
}
