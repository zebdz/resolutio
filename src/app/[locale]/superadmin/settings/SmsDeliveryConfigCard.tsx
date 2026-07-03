import { getTranslations } from 'next-intl/server';
import {
  smsDeliveryDisplayKeys,
  type SmsDeliveryConfig,
} from '@/infrastructure/auth/smsDeliveryConfig';

export async function SmsDeliveryConfigCard({
  config,
}: {
  config: SmsDeliveryConfig;
}) {
  const t = await getTranslations('superadmin.settings.smsDelivery');
  const keys = smsDeliveryDisplayKeys(config);

  const maxCostText =
    keys.maxCostKey === 'maxCostValue'
      ? t('maxCostValue', { value: config.maxCostRubles ?? 0 })
      : t(keys.maxCostKey);

  const rows: { label: string; value: string; emphasis?: boolean }[] = [
    { label: t('channelLabel'), value: t(keys.channelKey) },
    { label: t('testModeLabel'), value: t(keys.testModeKey) },
    { label: t('maxCostLabel'), value: maxCostText, emphasis: true },
  ];

  return (
    <div className="space-y-4 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('title')}
        </h2>
        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
          {t('readOnlyTag')}
        </span>
      </div>

      <p className="text-sm text-zinc-600 dark:text-zinc-400">
        {t('subtitle')}
      </p>

      <dl className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {rows.map((row) => (
          <div
            key={row.label}
            className="flex items-center justify-between gap-4 py-3"
          >
            <dt className="text-sm text-zinc-600 dark:text-zinc-400">
              {row.label}
            </dt>
            <dd
              className={
                row.emphasis
                  ? 'text-sm font-semibold text-zinc-900 dark:text-zinc-100'
                  : 'text-sm text-zinc-900 dark:text-zinc-100'
              }
            >
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
