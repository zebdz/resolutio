/** Loads the permission-filtered action view and renders results with related reports. */
import { getLocale, getTranslations } from 'next-intl/server';
import { UserId } from '@/domain/shared/EntityIds';
import { getCurrentUser } from '@/web/lib/session';
import { getPollResultsAction } from '@/src/web/actions/poll/vote';
import { getPollByIdAction } from '@/src/web/actions/poll/poll';
import { listReportsAction } from '@/web/actions/report/report';
import PollResults from '@/src/web/components/polls/results/PollResults';
import { WeightConfigLabel } from '@/src/web/components/polls/results/WeightConfigLabel';
import { Heading } from '@/src/web/components/catalyst/heading';
import ReportCard from '@/web/components/report/ReportCard';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { User } from '@/domain/user/User';
import {
  prisma,
  PrismaOrganizationPropertyRepository,
  PrismaOrganizationRepository,
  PrismaPropertyAssetRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { PollWeightCalculator } from '@/application/poll/PollWeightCalculator';
import { MarkdownRenderer } from '@/web/components/markdown/MarkdownRenderer';
import { POLL_ATTACHMENT_API_PREFIX } from '@/domain/poll/PollAttachment';
import { redirectLocalized } from '@/web/lib/redirectLocalized';

const userRepository = new PrismaUserRepository(prisma);

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
    redirectLocalized(await getLocale(), '/polls');
  }

  const poll = pollResult.data;

  // Fetch properties for weight config label + building total (parallel).
  const [resultsResult, propertiesResult, buildingTotalResult] =
    await Promise.all([
      getPollResultsAction(pollId),
      propertyRepository.findByOrganization(poll.organizationId),
      pollWeightCalculator.computeBuildingTotal({
        organizationId: poll.organizationId,
        distributionType: poll.distributionType,
        propertyAggregation: poll.propertyAggregation,
        propertyIds: poll.propertyIds,
      }),
    ]);
  // Preserve the UI payload: absent EQUAL denominator becomes 0 to hide the building stat.
  const buildingTotal = buildingTotalResult.success
    ? (buildingTotalResult.value ?? 0)
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

  // Reports citing this poll (filtered to those the viewer can see)
  const attachedReportsResult = await listReportsAction({
    attachedPollId: pollId,
    publishedOnly: true,
    pageSize: 20,
  });
  const attachedReports = attachedReportsResult.success
    ? attachedReportsResult.data.reports
    : [];
  const attachedReportAuthorIds = [
    ...new Set(attachedReports.map((r) => UserId.parse(r.createdById))),
  ];
  const attachedReportAuthors =
    attachedReportAuthorIds.length > 0
      ? await userRepository.findByIds(attachedReportAuthorIds)
      : [];
  const attachedReportAuthorMap = new Map<string, User>(
    attachedReportAuthors.map((a) => [a.id, a])
  );

  // The action filters identities and signing contacts before returning its plain view.
  const canViewVoters = results.canViewVoterNames;
  const canViewSignWillingness = results.canViewSignWillingness;
  const serializedResults = results.results;

  return (
    <AuthenticatedLayout>
      <div className="mb-8">
        <Heading>{t('title')}</Heading>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{poll.title}</p>
        {poll.description && (
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            <MarkdownRenderer
              source={poll.description}
              apiPrefix={POLL_ATTACHMENT_API_PREFIX}
              allowedAttachmentIds={poll.attachmentIds ?? []}
            />
          </div>
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
        canViewVoterNames={canViewVoters}
        canViewSignWillingness={canViewSignWillingness}
        isAnonymous={!!poll.anonymous}
        buildingTotal={buildingTotal}
        isOpenPoll={poll.pollType === 'OPEN'}
      />

      {attachedReports.length > 0 && (
        <section className="mt-10 space-y-4">
          <Heading level={2}>{t('attachedReportsHeading')}</Heading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {attachedReports.map((report) => {
              const author = attachedReportAuthorMap.get(report.createdById);
              const authorInfo = author
                ? {
                    firstName: author.firstName,
                    lastName: author.lastName,
                    middleName: author.middleName ?? null,
                  }
                : { firstName: '?', lastName: '?', middleName: null };

              return (
                <ReportCard
                  key={report.id}
                  report={{
                    id: report.id,
                    title: report.title,
                    body: report.body,
                    state: report.state as 'DRAFT' | 'PUBLISHED',
                    visibility: report.visibility,
                    lastPublishedAt: report.lastPublishedAt,
                    createdAt: report.createdAt,
                    archivedAt: report.archivedAt,
                    organizationId: report.organizationId,
                  }}
                  author={authorInfo}
                />
              );
            })}
          </div>
        </section>
      )}
    </AuthenticatedLayout>
  );
}
