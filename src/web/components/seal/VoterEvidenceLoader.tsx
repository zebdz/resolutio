'use client';

/** Fetch the current viewer's permitted evidence outside Flight. Imported receipt
 * files and codes stay inside the nested verifier and are never part of a request. */
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import { Link, useRouter } from '@/src/i18n/routing';
import { VoteProofVerifier } from './VoteProofVerifier';

const evidence = z.strictObject({
  bundle: z.string(),
  proof: z.array(z.number().int().min(0).max(255)).nullable(),
  storedCode: z
    .string()
    .regex(/^[0-9a-f]{64}$/)
    .nullable(),
});
const denied = z.object({
  error: z.string(),
  next: z
    .enum(['/login', '/confirm-phone', '/privacy-setup', '/blocked'])
    .optional(),
});
type Load =
  | { kind: 'loading' }
  | { kind: 'failed'; code: string }
  | { kind: 'ready'; value: z.infer<typeof evidence> };

export function VoterEvidenceLoader({ pollId }: { pollId: string }) {
  const t = useTranslations();
  const router = useRouter();
  const [state, setState] = useState<Load>({ kind: 'loading' });
  const base = '/api/polls/' + encodeURIComponent(pollId) + '/seal/';

  useEffect(() => {
    const controller = new AbortController();

    async function load() {
      try {
        const response = await fetch(base + 'voter-check', {
          signal: controller.signal,
          cache: 'no-store',
          credentials: 'same-origin',
        });
        const body: unknown = await response.json();

        if (controller.signal.aborted) {
          return;
        }

        if (!response.ok) {
          const refused = denied.safeParse(body);

          if (refused.success && refused.data.next) {
            router.replace(refused.data.next);

            return;
          }

          setState({
            kind: 'failed',
            code: refused.success
              ? refused.data.error
              : 'common.errors.unexpected',
          });

          return;
        }

        const parsed = evidence.safeParse(body);
        setState(
          parsed.success
            ? { kind: 'ready', value: parsed.data }
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
  }, [base, router]);

  if (state.kind === 'loading') {
    return <p role="status">{t('common.loading')}</p>;
  }

  if (state.kind === 'failed') {
    return (
      <p role="alert">
        {t(t.has(state.code) ? state.code : 'common.errors.unexpected')}
      </p>
    );
  }

  return (
    <>
      <VoteProofVerifier {...state.value} />
      <nav className="flex flex-wrap gap-4 text-sm">
        <a
          className="cursor-pointer underline"
          href={base + 'my-proof'}
          download
        >
          {t('sealPrivate.downloadBundle')}
        </a>
        <Link className="cursor-pointer underline" href={`/verify/${pollId}`}>
          {t('sealPrivate.publicSeal')}
        </Link>
      </nav>
    </>
  );
}
