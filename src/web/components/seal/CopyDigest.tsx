/** Show the entire digest on narrow screens and copy its exact hexadecimal text. */
import { useTranslations } from 'next-intl';
import { CopyButton } from './CopyButton';

export function CopyDigest({ digest }: { digest: string }) {
  const t = useTranslations('sealStatus');

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2">
      <code className="min-w-0 break-all text-xs">{digest}</code>
      <CopyButton
        value={digest}
        label={t('copy')}
        copiedLabel={t('copied')}
        failedLabel={t('copyFailed')}
      />
    </div>
  );
}
