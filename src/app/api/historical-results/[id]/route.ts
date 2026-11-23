/** Export reproduced historical results with original dates, votes and provenance. */
import { getCurrentUser } from '@/web/lib/session';
import { readPoll, readQuestion } from '@/infrastructure/history/history';
import {
  HistoricalPollId,
  HistoricalQuestionId,
} from '@/domain/history/HistoryIds';

export async function GET(
  _: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const id = HistoricalPollId.safeParse((await params).id);

  if (!id.success) {
    return new Response(null, { status: 404 });
  }

  const viewer = (await getCurrentUser())?.id ?? null;
  const poll = await readPoll(viewer, id.data);

  if (!poll) {
    return new Response(null, { status: 404 });
  }

  const questions = [];

  for (const q of poll.questions) {
    questions.push(
      await readQuestion(
        viewer,
        HistoricalQuestionId.parse(String(q.id)),
        false
      )
    );
  }

  return Response.json(
    {
      weights: 'source snapshot',
      ...poll,
      questions,
    },
    {
      headers: {
        'cache-control': 'private, no-store',
        'content-disposition':
          'attachment; filename="historical-results-' + id.data + '.json"',
      },
    }
  );
}
