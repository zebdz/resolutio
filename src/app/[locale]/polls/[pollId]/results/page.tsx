/** Render only the poll ID in Flight. The authenticated HTTP reader resolves the
 * viewer and filters the complete results view before it reaches the browser. */
import { notFound } from 'next/navigation';
import { PollId } from '@/domain/shared/EntityIds';
import { ResultsPageLoader } from '@/web/components/polls/results/ResultsPageLoader';

export default async function ResultsPage({
  params,
}: {
  params: Promise<{ pollId: string; locale: string }>;
}) {
  const pollId = PollId.safeParse((await params).pollId);

  if (!pollId.success) {
    notFound();
  }

  return <ResultsPageLoader key={pollId.data} pollId={pollId.data} />;
}
