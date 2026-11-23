'use client';

/** Localized public anchor state shared by poll cards, results and the public seal page. */
import { useFormatter, useTranslations } from 'next-intl';
import type { SealStatus } from '@/application/seal/SealSummary';
import { Badge } from '@/web/components/catalyst/badge';

export function SealStatusBadge({ status }: { status: SealStatus }) {
  const t = useTranslations('sealStatus');
  const format = useFormatter();
  const label =
    status.kind === 'bitcoin'
      ? t('bitcoin', {
          height: String(status.height),
          date: format.dateTime(new Date(status.time), {
            dateStyle: 'medium',
            timeZone: 'UTC',
          }),
        })
      : t(status.kind);

  return (
    <Badge
      color={
        status.kind === 'bitcoin'
          ? 'green'
          : status.kind === 'failed'
            ? 'red'
            : 'zinc'
      }
    >
      {label}
    </Badge>
  );
}
