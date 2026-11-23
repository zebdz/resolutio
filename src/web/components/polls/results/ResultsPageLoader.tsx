'use client';

/** Fetch the results page outside React Flight. Private results and navigation are
 * shown only after the server checks the current session and result permissions. */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import type { PollId } from '@/domain/shared/EntityIds';
import { Link, useRouter } from '@/src/i18n/routing';
import { resultsPageSchema, type ResultsPageView } from './ResultsPageView';
import { ResultsPageContent } from './ResultsPageContent';

const refused = z.object({
  error: z.string(),
  next: z
    .enum(['/login', '/confirm-phone', '/privacy-setup', '/blocked'])
    .optional(),
});
type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; code: string }
  | { kind: 'ready'; view: ResultsPageView };

export function ResultsPageLoader({ pollId }: { pollId: PollId }) {
  const t = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<Load>({ kind: 'loading' });

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(
          '/api/polls/' + encodeURIComponent(pollId) + '/results',
          {
            signal: controller.signal,
            credentials: 'same-origin',
            cache: 'no-store',
          }
        );
        const body: unknown = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        if (!response.ok) {
          const failure = refused.safeParse(body);

          if (failure.success && failure.data.next) {
            router.replace(failure.data.next);

            return;
          }

          setState({
            kind: 'failed',
            code: failure.success
              ? failure.data.error
              : 'common.errors.unexpected',
          });

          return;
        }

        const result = resultsPageSchema.safeParse(body);
        setState(
          result.success && result.data.results.pollId === pollId
            ? { kind: 'ready', view: result.data }
            : { kind: 'failed', code: 'common.errors.unexpected' }
        );
      } catch {
        if (!controller.signal.aborted) {
          setState({ kind: 'failed', code: 'common.errors.unexpected' });
        }
      }
    }

    void load();

    return () => controller.abort();
  }, [pollId, router]);

  if (state.kind === 'ready') {
    return <ResultsPageContent view={state.view} />;
  }

  return (
    <main className="mx-auto max-w-4xl space-y-4 px-4 py-8 sm:px-6">
      {state.kind === 'loading' ? (
        <p role="status">{t('common.loading')}</p>
      ) : (
        <>
          <p role="alert">
            {t(t.has(state.code) ? state.code : 'common.errors.unexpected')}
          </p>
          <Link
            href="/polls"
            className="cursor-pointer text-sky-700 underline dark:text-sky-300"
          >
            {t('navbar.polls')}
          </Link>
        </>
      )}
    </main>
  );
}
