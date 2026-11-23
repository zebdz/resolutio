/** Read-only historical meeting results and question-scoped report projections.
 * All queries run on the server. The Markdown component receives only the authorized body. */
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { redirectLocalized } from '@/web/lib/redirectLocalized';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { readPoll, readQuestion } from '@/infrastructure/history/history';
import {
  HistoricalPollId,
  HistoricalQuestionId,
} from '@/domain/history/HistoryIds';
import { MarkdownRenderer } from '@/web/components/markdown/MarkdownRenderer';
import { Link } from '@/src/i18n/routing';

const linkClass =
  'cursor-pointer text-emerald-700 underline dark:text-emerald-400';

export async function HistoricalRecord({
  kind,
  id: rawId,
  locale,
}: {
  kind: 'poll' | 'question' | 'report';
  id: string;
  locale: string;
}) {
  const [user, t] = await Promise.all([
    getCurrentUser(),
    getTranslations('history'),
  ]);
  const viewer = user?.id ?? null;
  const date = (v: Date | null) =>
    v ? v.toLocaleString(locale, { timeZone: 'Europe/Moscow' }) : t('unknown');
  const files = (
    assets: {
      key: string;
      caption: string | null;
      kind: string;
      path: string;
    }[]
  ) => (
    <ul>
      {assets
        .filter((a) => a.kind !== 'inline')
        .map((a) => (
          <li key={a.key}>
            <a
              className={linkClass}
              href={'/api/historical-attachments/' + a.key}
            >
              {a.kind === 'protocol'
                ? t('original')
                : a.caption || a.path.split('/').at(-1)}
            </a>
          </li>
        ))}
    </ul>
  );
  let content;
  let organizationId;

  if (kind === 'poll') {
    const id = HistoricalPollId.safeParse(rawId);

    if (!id.success) {
      notFound();
    }

    const poll = await readPoll(viewer, id.data);

    if (!poll) {
      notFound();
    }

    if (poll.native_poll_id) {
      redirectLocalized(locale, '/polls/' + poll.native_poll_id + '/results');
    }

    organizationId = poll.organization_id;
    content = (
      <>
        <h1>{poll.title}</h1>
        <p>{t('provenance')}</p>
        <dl>
          <dt>{t('start')}</dt>
          <dd>{date(poll.started)}</dd>
          <dt>{t('finish')}</dt>
          <dd>
            {date(poll.finished)} {poll.finish_from_import && t('importDate')}
          </dd>
          <dt>{t('attendance')}</dt>
          <dd>
            {poll.attendance} / {poll.denominator}
          </dd>
        </dl>
        {files(poll.assets)}
        <a className={linkClass} href={'/api/historical-results/' + poll.id}>
          {t('export')}
        </a>
        <ol>
          {poll.questions.map((q) => (
            <li key={q.id}>
              <Link className={linkClass} href={'/polls/questions/' + q.id}>
                {q.title}
              </Link>
            </li>
          ))}
        </ol>
      </>
    );
  } else {
    const id = HistoricalQuestionId.safeParse(rawId);

    if (!id.success) {
      notFound();
    }

    const projection = kind === 'report';
    const q = await readQuestion(viewer, id.data, projection);

    if (!q) {
      notFound();
    }

    if (projection && q.native_report_id) {
      redirectLocalized(locale, '/reports/' + q.native_report_id);
    }

    organizationId = q.organization_id;
    content = (
      <>
        <h1>{q.title}</h1>
        <p>
          {q.author} · {date(q.created)}
        </p>
        <MarkdownRenderer
          source={q.body}
          apiPrefix="/api/historical-attachments"
          allowedAttachmentIds={q.assets.map((a) => a.key)}
        />
        {files(q.assets)}
        {q.score !== null && <p>{t('score', { score: q.score })}</p>}
        {q.answers.length > 0 && (
          <>
            <p>{t('provenance')}</p>
            <table>
              <thead>
                <tr>
                  {(['answer', 'count', 'percent', 'weight'] as const).map(
                    (k) => (
                      <th key={k}>{t(k)}</th>
                    )
                  )}
                </tr>
              </thead>
              <tbody>
                {q.answers.map((a) => (
                  <tr key={a.id}>
                    <td>{a.label}</td>
                    <td>{a.ballots}</td>
                    <td>{a.percent}%</td>
                    <td>{a.weight}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
        {q.votes.length > 0 && (
          <details>
            <summary className="cursor-pointer">{t('register')}</summary>
            <ul>
              {q.votes.map((v) => (
                <li key={v.id}>
                  {v.name} · {v.label} · {date(v.cast_at)}{' '}
                  {v.cast_from_import && t('importDate')}
                </li>
              ))}
            </ul>
          </details>
        )}
        {q.parent && (
          <Link className={linkClass} href={'/polls/' + q.parent + '/results'}>
            {t('parent')}
          </Link>
        )}
        {!projection && q.report && (
          <Link
            className={linkClass}
            href={'/reports/' + (q.native_report_id ?? q.id)}
          >
            {t('report')}
          </Link>
        )}
      </>
    );
  }

  const record = (
    <main className="prose prose-zinc mx-auto max-w-4xl space-y-4 px-4 py-8 dark:prose-invert">
      <Link
        className={linkClass}
        href={
          kind === 'report'
            ? '/reports?organizationIds=' + encodeURIComponent(organizationId)
            : '/polls?orgId=' + encodeURIComponent(organizationId)
        }
      >
        {t(kind === 'report' ? 'reports' : 'meetings')}
      </Link>
      {content}
    </main>
  );

  return user ? <AuthenticatedLayout>{record}</AuthenticatedLayout> : record;
}
