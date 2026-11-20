'use client';

/** Displays the session voter's frozen cast evidence. Downloads retain the exact
 * original JSON bytes so the saved file can later be checked independently. */
import { useTranslations } from 'next-intl';
import type { VoteReceiptView } from '@/application/poll/VoteReceiptView';
import { Button } from '@/web/components/catalyst/button';
import { Heading, Subheading } from '@/web/components/catalyst/heading';
import { Text, TextLink } from '@/web/components/catalyst/text';
import { CopyButton } from './CopyButton';

export function VoteReceiptPanel({ view }: { view: VoteReceiptView }) {
  const t = useTranslations('sealReceipt');

  if (view.kind === 'legacy') {
    return (
      <section className="space-y-3">
        <Heading>{t('recorded')}</Heading>
        <Text>{t('legacy')}</Text>
        <TextLink href="/polls">{t('back')}</TextLink>
      </section>
    );
  }

  const { receipt, canonicalReceipt, emailStatus } = view;

  function download() {
    const url = URL.createObjectURL(
      new Blob([canonicalReceipt], { type: 'application/json' })
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = 'receipt.json';
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <section className="max-w-3xl space-y-6">
      <header className="space-y-2">
        <Heading>{t('title')}</Heading>
        <Subheading>{receipt.pollTitle}</Subheading>
        <Text>{emailStatus ? t('retain') : t('replay')}</Text>
      </header>
      <div className="space-y-3">
        <Button type="button" onClick={download}>
          {t('download')}
        </Button>
        {emailStatus && <Text>{t(emailStatus)}</Text>}
        {emailStatus === 'unconfirmed' && (
          <TextLink href="/account">{t('confirmEmail')}</TextLink>
        )}
      </div>
      <div className="space-y-2">
        <Subheading>{t('privateCode')}</Subheading>
        <code className="block break-all select-all font-mono text-sm">
          {receipt.receiptSecret}
        </code>
        <CopyButton
          value={receipt.receiptSecret}
          label={t('copyCode')}
          copiedLabel={t('copied')}
          failedLabel={t('copyFailed')}
        />
      </div>
      <div className="space-y-2">
        <Subheading>{t('answers')}</Subheading>
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {receipt.leaves.map(({ hash, questionText, answerText }) => (
            <li key={hash} className="space-y-1 py-3">
              <p className="break-words font-medium">{questionText}</p>
              <p className="break-words">{answerText}</p>
              <p className="text-sm">
                {t('leafHash')}{' '}
                <code className="break-all select-all font-mono">{hash}</code>
              </p>
            </li>
          ))}
        </ul>
      </div>
      <div className="flex flex-wrap gap-4">
        <TextLink href={`/polls/${receipt.pollId}/verify-my-vote`}>
          {t('verify')}
        </TextLink>
        <TextLink href="/polls">{t('back')}</TextLink>
      </div>
    </section>
  );
}
