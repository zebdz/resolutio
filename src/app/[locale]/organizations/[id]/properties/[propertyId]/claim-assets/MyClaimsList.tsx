'use client';

import { useTranslations } from 'next-intl';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';

export function MyClaimsList({
  claims,
}: {
  claims: {
    id: string;
    assetName: string;
    status: string;
    deniedReason: string | null;
    createdAt: string;
    decidedAt: string | null;
  }[];
}) {
  const t = useTranslations('propertyClaim.myClaims');
  const tStatus = useTranslations('propertyClaim.status');

  if (claims.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <Heading level={2}>{t('title')}</Heading>
      <ul className="divide-y">
        {claims.map((c) => (
          <li key={c.id} className="py-2">
            <div className="font-medium">{c.assetName}</div>
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {tStatus(c.status.toLowerCase())} ·{' '}
              {new Date(c.createdAt).toLocaleDateString()}
            </div>
            {c.status === 'DENIED' && c.deniedReason && (
              <Text className="text-sm text-red-600">
                {t('reasonLabel')}: {c.deniedReason}
              </Text>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
