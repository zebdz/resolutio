import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import {
  SuspiciousActivityPanel,
  type SerializedSuspiciousKeySummary,
} from './SuspiciousActivityPanel';
import { getSuspiciousActivitySummaryAction } from '@/src/web/actions/superadmin/suspiciousActivity';

const PAGE_SIZE = 20;

interface SuspiciousActivityPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    minBlocked?: string;
    maxBlocked?: string;
  }>;
}

export default async function SuspiciousActivityPage({
  searchParams,
}: SuspiciousActivityPageProps) {
  const t = await getTranslations('superadmin.suspiciousActivity');
  const tHub = await getTranslations('superadmin.hub');
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);
  const minBlocked = params.minBlocked
    ? parseInt(params.minBlocked, 10) || undefined
    : undefined;
  const maxBlocked = params.maxBlocked
    ? parseInt(params.maxBlocked, 10) || undefined
    : undefined;

  const result = await getSuspiciousActivitySummaryAction({
    page,
    pageSize: PAGE_SIZE,
    search: params.search || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    minBlocked,
    maxBlocked,
  });

  const data = result.success ? result.data : { items: [], totalCount: 0 };

  const totalPages = Math.max(1, Math.ceil(data.totalCount / PAGE_SIZE));

  // Serialize Date objects for client component
  const items: SerializedSuspiciousKeySummary[] = data.items.map((item) => ({
    ...item,
    firstEventAt: item.firstEventAt.toISOString(),
    lastEventAt: item.lastEventAt.toISOString(),
    blockStatus: item.blockStatus
      ? {
          ...item.blockStatus,
          blockedAt: item.blockStatus.blockedAt
            ? item.blockStatus.blockedAt.toISOString()
            : undefined,
        }
      : item.blockStatus,
  }));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/superadmin"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; {tHub('back')}
        </Link>
        <Heading level={2} className="text-xl font-semibold">
          {t('title')}
        </Heading>
        <Text className="text-zinc-600 dark:text-zinc-400">
          {t('subtitle')}
        </Text>
      </div>

      <SuspiciousActivityPanel
        items={items}
        totalPages={totalPages}
        currentPage={page}
        filters={{
          search: params.search ?? '',
          dateFrom: params.dateFrom ?? '',
          dateTo: params.dateTo ?? '',
          minBlocked: params.minBlocked ?? '',
          maxBlocked: params.maxBlocked ?? '',
        }}
      />
    </div>
  );
}
