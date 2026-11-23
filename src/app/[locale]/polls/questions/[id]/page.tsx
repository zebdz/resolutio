/** Read-only question details for historical voting records, including viewer-scoped registers. */
import { HistoricalRecord } from '@/web/components/history/HistoricalRecord';

export default async function QuestionPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;

  return <HistoricalRecord kind="question" id={id} locale={locale} />;
}
