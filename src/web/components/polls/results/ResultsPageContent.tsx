'use client';

/** Display the authorized results page, including frozen labels and source-specific
 * seal links. Reports and account navigation retain their current state. */
import { useTranslations } from 'next-intl';
import { POLL_ATTACHMENT_API_PREFIX } from '@/domain/poll/PollAttachment';
import { StackedLayout } from '@/web/components/catalyst/stacked-layout';
import { Heading } from '@/web/components/catalyst/heading';
import { AppNavbar } from '@/web/components/layout/AppNavbar';
import { MobileSidebar } from '@/web/components/layout/MobileSidebar';
import { MarkdownRenderer } from '@/web/components/markdown/MarkdownRenderer';
import ReportCard from '@/web/components/report/ReportCard';
import { ResultsSeal } from '@/web/components/seal/ResultsSeal';
import { WeightConfigLabel } from './WeightConfigLabel';
import PollResults from './PollResults';
import type { ResultsPageView } from './ResultsPageView';

export function ResultsPageContent({ view }: { view: ResultsPageView }) {
  const t = useTranslations('poll.results');

  return (
    <StackedLayout
      navbar={<AppNavbar {...view.navigation} />}
      sidebar={<MobileSidebar {...view.navigation} />}
    >
      <div className="mb-8">
        <Heading>{t('title')}</Heading>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">{view.title}</p>
        {view.description && (
          <div className="mt-1 text-sm text-zinc-500 dark:text-zinc-500">
            <MarkdownRenderer
              source={view.description}
              apiPrefix={POLL_ATTACHMENT_API_PREFIX}
              allowedAttachmentIds={view.attachmentIds}
            />
          </div>
        )}
      </div>
      <div className="mb-4">
        <WeightConfigLabel
          distributionType={view.distributionType}
          propertyAggregation={view.propertyAggregation}
          scopedPropertyNames={view.scopedPropertyNames}
          showAggregation={view.showAggregation}
        />
      </div>
      <ResultsSeal pollId={view.results.pollId} coverage={view.coverage} />
      <PollResults
        results={view.results}
        pollState={view.pollState}
        isPollCreator={view.isPollCreator}
        canViewVoterNames={view.canViewVoterNames}
        canViewSignWillingness={view.canViewSignWillingness}
        isAnonymous={view.isAnonymous}
        buildingTotal={view.buildingTotal}
        isOpenPoll={view.isOpenPoll}
      />
      {view.reports.length > 0 && (
        <section className="mt-10 space-y-4">
          <Heading level={2}>{t('attachedReportsHeading')}</Heading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {view.reports.map(({ report, author }) => (
              <ReportCard key={report.id} report={report} author={author} />
            ))}
          </div>
        </section>
      )}
    </StackedLayout>
  );
}
