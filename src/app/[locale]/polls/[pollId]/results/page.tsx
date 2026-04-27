import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { getPollResultsAction } from '@/src/web/actions/poll/vote';
import { getPollByIdAction } from '@/src/web/actions/poll/poll';
import PollResults from '@/src/web/components/polls/results/PollResults';
import { WeightConfigLabel } from '@/src/web/components/polls/results/WeightConfigLabel';
import { Heading } from '@/src/web/components/catalyst/heading';
import {
  AnswerResult,
  QuestionResult,
  ProtocolSignWillingnessEntry,
} from '@/src/application/poll/GetPollResultsUseCase';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { User } from '@/domain/user/User';
import {
  prisma,
  PrismaOrganizationPropertyRepository,
  PrismaOrganizationRepository,
  PrismaPropertyAssetRepository,
} from '@/infrastructure/index';
import { PollWeightCalculator } from '@/application/poll/PollWeightCalculator';
import { DistributionType } from '@/domain/poll/DistributionType';
import { PropertyAggregation } from '@/domain/poll/PropertyAggregation';

const propertyRepository = new PrismaOrganizationPropertyRepository(prisma);
const pollWeightCalculator = new PollWeightCalculator(
  new PrismaOrganizationRepository(prisma),
  new PrismaPropertyAssetRepository(prisma)
);

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

  // Fetch properties for weight config label + building total (parallel).
  const [resultsResult, propertiesResult, buildingTotalResult] =
    await Promise.all([
      getPollResultsAction(pollId),
      propertyRepository.findByOrganization(poll.organizationId),
      pollWeightCalculator.computeBuildingTotal({
        organizationId: poll.organizationId,
        distributionType: poll.distributionType as DistributionType,
        propertyAggregation: poll.propertyAggregation as PropertyAggregation,
        propertyIds: poll.propertyIds,
      }),
    ]);
  // 0 for EQUAL polls; the UI hides the building stat in that case.
  const buildingTotal = buildingTotalResult.success
    ? buildingTotalResult.value
    : 0;

  const allProperties = propertiesResult.success
    ? propertiesResult.value.map((p) => ({ id: p.id, name: p.name }))
    : [];

  const scopedPropertyNames =
    poll.propertyIds.length === 0
      ? []
      : allProperties
          .filter((p) => poll.propertyIds.includes(p.id))
          .map((p) => p.name);

  const isOwnership =
    poll.distributionType === 'OWNERSHIP_UNIT_COUNT' ||
    poll.distributionType === 'OWNERSHIP_SIZE_WEIGHTED';

  const effectiveScopeCount =
    poll.propertyIds.length === 0
      ? allProperties.length
      : poll.propertyIds.length;

  const showAggregation = isOwnership && effectiveScopeCount >= 2;

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
      // Σ answer weights (double-counts multi-choice voters); used for
      // displaying answer-share percentages where each tick is a separate row.
      totalWeight: q.answers.reduce(
        (sum: number, a: any) => sum + a.totalWeight,
        0
      ),
      // Σ unique voters' weights — the right denominator for "% of building"
      // since participation is per voter, not per tick.
      participantWeight: q.participantWeight,
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
              userName: User.formatFullName(
                v.userName.firstName,
                v.userName.lastName,
                v.userName.middleName
              ),
              weight:
                typeof v.weight === 'object' ? Number(v.weight) : v.weight,
            }))
          : [], // Empty array if user doesn't have permission
      })),
    })),
    // SECURITY: Only include protocol sign willingness if user has admin permission
    protocolSignWillingness: canViewVoters
      ? results.protocolSignWillingness.map(
          (entry: ProtocolSignWillingnessEntry) => ({
            userId: entry.userId,
            firstName: entry.firstName,
            lastName: entry.lastName,
            middleName: entry.middleName,
            willingToSignProtocol: entry.willingToSignProtocol,
          })
        )
      : [],
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

      <div className="mb-4">
        <WeightConfigLabel
          distributionType={poll.distributionType}
          propertyAggregation={poll.propertyAggregation}
          scopedPropertyNames={scopedPropertyNames}
          showAggregation={showAggregation}
        />
      </div>

      <PollResults
        results={serializedResults}
        pollState={poll.state}
        isPollCreator={isPollCreator}
        canViewVoters={canViewVoters}
        buildingTotal={buildingTotal}
      />
    </AuthenticatedLayout>
  );
}
