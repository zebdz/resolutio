/** Render only the poll ID in Flight. The authenticated HTTP reader resolves the
 * viewer and filters the complete results view before it reaches the browser. */
import { HistoricalRecord } from '@/web/components/history/HistoricalRecord';
import { HistoricalPollId } from '@/domain/history/HistoryIds';
import { notFound } from 'next/navigation';
import { PollId } from '@/domain/shared/EntityIds';
import { ResultsPageLoader } from '@/web/components/polls/results/ResultsPageLoader';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ pollId: string; locale: string }>;
}) {
  const { pollId: id, locale } = await params;

  if (HistoricalPollId.safeParse(id).success) {
    return <HistoricalRecord kind="poll" id={id} locale={locale} />;
  }

  const pollId = PollId.safeParse(id);

  if (!pollId.success) {
    notFound();
  }

  return <ResultsPageLoader key={pollId.data} pollId={pollId.data} />;
}
