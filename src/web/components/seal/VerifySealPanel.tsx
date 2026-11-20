'use client';
/** Allow any visitor to check the public manifest and timestamp, with optional authorized or saved sections. */
import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';
import { Subheading } from '@/web/components/catalyst/heading';
import type {
  checkPublishedRecord,
  PublishedRecordCheck,
} from './checkPublishedRecord';

export function VerifySealPanel(
  props: PublishedRecordCheck & { loadingAccess: boolean }
) {
  const t = useTranslations('sealPublic');
  const errors = useTranslations();
  const [file, setFile] = useState<File>();
  const [checking, setChecking] = useState(false);
  const [result, setResult] =
    useState<Awaited<ReturnType<typeof checkPublishedRecord>>>();

  async function check() {
    setChecking(true);
    setResult(undefined);

    try {
      const { checkPublishedRecord } = await import('./checkPublishedRecord');
      setResult(await checkPublishedRecord(props, file));
    } finally {
      setChecking(false);
    }
  }

  return (
    <section className="space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700">
      <Subheading>{t('browserTitle')}</Subheading>
      <p>{t('browserInfo')}</p>
      <label className="block">
        <span className="block mb-1">{t('sectionsFile')}</span>
        <input
          type="file"
          accept=".json,application/json"
          className="block w-full text-sm file:mr-3 file:rounded-md file:border file:px-2 file:py-1 file:cursor-pointer"
          disabled={checking}
          onChange={(e) => {
            setFile(e.target.files?.[0]);
            setResult(undefined);
          }}
        />
      </label>
      <Button
        type="button"
        disabled={checking || props.loadingAccess}
        onClick={check}
      >
        {t(checking ? 'checking' : 'check')}
      </Button>
      <div role="status" aria-live="polite" className="space-y-1">
        {result &&
          (result.success ? (
            <>
              <p>{t('manifestChecked')}</p>
              <p>
                {result.value.verifiedSections.length
                  ? t('checked', {
                      sections: result.value.verifiedSections
                        .map((section) => t(section))
                        .join(', '),
                    })
                  : t('noSections')}
              </p>
              <p>{t(result.value.timestamp)}</p>
            </>
          ) : (
            <p className="text-red-700 dark:text-red-400">
              {errors(result.error)}
            </p>
          ))}
      </div>
    </section>
  );
}
