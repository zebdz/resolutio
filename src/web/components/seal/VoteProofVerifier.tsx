'use client';

/** Compares a privately imported cast-time receipt, or checks current inclusion with
 * the voter's code. Local file bytes and pasted secrets never leave the browser. */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';
import type { checkLocalBallot } from './localBallotCheck';

type Report = Awaited<ReturnType<typeof checkLocalBallot>>;
const fileClass =
  'block w-full cursor-pointer text-sm file:mr-3 file:cursor-pointer file:rounded-md file:border file:border-zinc-300 file:px-3 file:py-2 dark:file:border-zinc-600';
const sectionClass =
  'space-y-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700 sm:p-6';

export function VoteProofVerifier({
  bundle,
  proof,
  storedCode,
}: {
  bundle: string;
  proof: number[] | null;
  storedCode: string | null;
}) {
  const t = useTranslations('sealPrivate');
  const messages = useTranslations();
  const [mode, setMode] = useState<'receipt' | 'current'>('receipt');
  const [receipt, setReceipt] = useState<File | null>(null);
  const [labels, setLabels] = useState<File | null>(null);
  const [code, setCode] = useState('');
  const [checking, setChecking] = useState(false);
  const [result, setResult] = useState<Report | null>(null);

  async function verify() {
    if (mode === 'receipt' && !receipt) {
      return;
    }

    setChecking(true);
    setResult(null);

    try {
      const { checkLocalBallot } = await import('./localBallotCheck');
      const check = await checkLocalBallot({
        bundle,
        proof,
        labelsFile: labels,
        input:
          mode === 'receipt' && receipt
            ? { kind: 'receipt', file: receipt }
            : { kind: 'current', code: code.trim() || storedCode || undefined },
      });
      setResult(check);
    } finally {
      setChecking(false);
    }
  }

  return (
    <>
      <p>{t('localOnly')}</p>
      <fieldset
        className={sectionClass}
        disabled={checking}
        onChange={() => setResult(null)}
      >
        <legend className="px-1 font-semibold">{t('method')}</legend>
        <div className="flex flex-wrap gap-x-6 gap-y-2">
          {(['receipt', 'current'] as const).map((choice) => (
            <label
              key={choice}
              className="inline-flex cursor-pointer items-center gap-2"
            >
              <input
                type="radio"
                name="verificationMethod"
                checked={mode === choice}
                onChange={() => {
                  setMode(choice);
                  setReceipt(null);
                  setCode('');
                }}
              />
              {t(choice)}
            </label>
          ))}
        </div>
        {mode === 'receipt' ? (
          <label className="block space-y-2 text-sm">
            <span>{t('receiptFile')}</span>
            <input
              className={fileClass}
              type="file"
              accept=".json,application/json"
              onChange={(e) => setReceipt(e.target.files?.[0] ?? null)}
            />
          </label>
        ) : (
          <label className="block space-y-2 text-sm">
            <span>{t('code')}</span>
            <input
              className="block w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono dark:border-zinc-600"
              type="password"
              value={code}
              spellCheck={false}
              autoComplete="off"
              onChange={(e) => setCode(e.target.value)}
            />
            <span>{t(storedCode ? 'useStored' : 'noStored')}</span>
          </label>
        )}
        <details>
          <summary className="cursor-pointer text-sm underline">
            {t('retainedLabels')}
          </summary>
          <label className="mt-3 block space-y-2 text-sm">
            <span>{t('labelsFile')}</span>
            <input
              className={fileClass}
              type="file"
              accept=".json,application/json"
              onChange={(e) => setLabels(e.target.files?.[0] ?? null)}
            />
          </label>
        </details>
        <Button
          type="button"
          disabled={checking || (mode === 'receipt' && !receipt)}
          onClick={verify}
        >
          {t('check')}
        </Button>
      </fieldset>
      <div aria-live="polite" aria-atomic="true">
        {checking && <p role="status">{t('checking')}</p>}
        {result && !result.success && (
          <p role="alert" className="text-red-700 dark:text-red-300">
            {messages(result.error)}
          </p>
        )}
        {result?.success && (
          <section className={sectionClass}>
            <h2 className="font-semibold">{t(result.value.ballot)}</h2>
            <p>
              {t(
                result.value.labels === 'verified'
                  ? 'labelsVerified'
                  : 'labelsUnverified'
              )}
            </p>
            <p>{t(result.value.timestamp)}</p>
            <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
              {result.value.choices.map((choice) => (
                <li key={choice.hash} className="space-y-1 break-words py-3">
                  {choice.labels.kind !== 'unavailable' && (
                    <p>
                      <span className="font-medium">
                        {choice.labels.question}
                      </span>{' '}
                      — {choice.labels.answer}
                      {choice.labels.kind === 'receipt' && (
                        <span className="ml-2 text-sm">
                          ({t('receiptClaim')})
                        </span>
                      )}
                    </p>
                  )}
                  <p className="break-all text-sm">
                    {t('choice', {
                      question: choice.questionId,
                      answer: choice.answerId,
                      weight: choice.weight,
                    })}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
