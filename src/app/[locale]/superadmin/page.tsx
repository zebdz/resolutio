import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Link } from '@/src/i18n/routing';

const hubLinks = [
  {
    href: '/superadmin/organizations' as const,
    labelKey: 'organizationsLink' as const,
    descKey: 'organizationsDescription' as const,
  },
  {
    href: '/superadmin/rate-limits' as const,
    labelKey: 'rateLimitsLink' as const,
    descKey: 'rateLimitsDescription' as const,
  },
  {
    href: '/superadmin/suspicious-activity' as const,
    labelKey: 'suspiciousActivityLink' as const,
    descKey: 'suspiciousActivityDescription' as const,
  },
  {
    href: '/superadmin/users' as const,
    labelKey: 'usersLink' as const,
    descKey: 'usersDescription' as const,
  },
  {
    href: '/superadmin/blocked-ips' as const,
    labelKey: 'blockedIpsLink' as const,
    descKey: 'blockedIpsDescription' as const,
  },
  {
    href: '/superadmin/rate-monitor' as const,
    labelKey: 'monitorLink' as const,
    descKey: 'monitorDescription' as const,
  },
];

export default async function SuperadminPage() {
  const t = await getTranslations('superadmin.hub');

  return (
    <div className="space-y-8">
      <Heading className="text-3xl font-bold">{t('title')}</Heading>

      <div className="grid gap-4 sm:grid-cols-2">
        {hubLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-lg border border-zinc-200 p-6 transition-colors hover:border-zinc-400 hover:bg-zinc-50 dark:border-zinc-700 dark:hover:border-zinc-500 dark:hover:bg-zinc-800/50"
          >
            <Heading level={3} className="text-lg font-semibold">
              {t(link.labelKey)}
            </Heading>
            <Text className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
              {t(link.descKey)}
            </Text>
          </Link>
        ))}
      </div>
    </div>
  );
}
