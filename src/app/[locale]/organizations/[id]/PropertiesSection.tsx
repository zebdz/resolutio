'use client';

import { useTranslations } from 'next-intl';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import { Divider } from '@/src/web/components/catalyst/divider';

export interface SafeProperty {
  id: string;
  name: string;
  address: string | null;
}

export function PropertiesSection({
  organizationId,
  properties,
}: {
  organizationId: string;
  properties: SafeProperty[];
}) {
  const t = useTranslations('propertyClaim.section');

  return (
    <div id="properties">
      <Divider />
      <div className="space-y-4">
        <Heading level={2}>{t('title')}</Heading>
        {properties.length === 0 && <Text>{t('empty')}</Text>}
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {properties.map((p) => (
            <li key={p.id} className="py-3 flex flex-wrap items-center gap-2">
              <div className="flex-1 min-w-[200px]">
                <div className="font-medium">{p.name}</div>
                {p.address && (
                  <div className="text-sm text-zinc-600 dark:text-zinc-400">
                    {p.address}
                  </div>
                )}
              </div>
              <Link
                href={`/organizations/${organizationId}/properties/${p.id}/claim-assets`}
              >
                <Button color="brand-green">{t('claim')}</Button>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
