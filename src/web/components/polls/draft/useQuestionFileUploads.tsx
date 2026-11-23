'use client';

/** Let a saved draft recover from upload failures without submitting its questions twice. */
import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/web/components/catalyst/button';
import {
  uploadQuestionFiles,
  type QuestionFileUpload,
  type SendQuestionFile,
} from './questionFileUploads';

export function useQuestionFileUploads() {
  const t = useTranslations('poll.attachments');
  const locale = useLocale();
  const [pending, setPending] = useState<{
    pollId: string;
    files: Awaited<ReturnType<typeof uploadQuestionFiles>>;
    retry: () => Promise<void>;
  } | null>(null);
  const [retrying, setRetrying] = useState(false);

  async function finish(
    pollId: string,
    files: QuestionFileUpload[],
    send: SendQuestionFile,
    done: () => void | Promise<void>
  ) {
    const remaining = await uploadQuestionFiles(files, send);

    if (!remaining.length) {
      setPending(null);
      await done();

      return;
    }

    setPending({
      pollId,
      files: remaining,
      retry: () => finish(pollId, remaining, send, done),
    });
  }

  const recovery = pending ? (
    <section className="space-y-4 p-6">
      <p role="alert">{t('saveUploadFailed')}</p>
      <ul>
        {pending.files.map(({ file, error }, index) => (
          <li key={index}>
            {file.name} — {error}
          </li>
        ))}
      </ul>
      <Button
        type="button"
        disabled={retrying}
        onClick={async () => {
          setRetrying(true);

          try {
            await pending.retry();
          } finally {
            setRetrying(false);
          }
        }}
      >
        {t('retry')}
      </Button>
      <a
        href={'/' + locale + '/polls/' + pending.pollId + '/edit'}
        className="ml-3 cursor-pointer underline"
      >
        {t('openDraft')}
      </a>
    </section>
  ) : null;

  return { finish, recovery };
}
