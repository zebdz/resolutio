import { getTranslations } from 'next-intl/server';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Link } from '@/src/i18n/routing';
import { getUserOrganizationsAction } from '@/web/actions/organization';

export async function PendingJoinRequestsSection() {
  const t = await getTranslations('home');
  const result = await getUserOrganizationsAction();

  if (!result.success) {
    return null;
  }

  const count = result.data.pending.length + result.data.rejected.length;

  if (count === 0) {
    return null;
  }

  return (
    <Link
      href="/join-requests"
      className="block rounded-lg border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
    >
      <div className="flex items-center gap-3">
        <span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('pendingRequests')}
        </span>
        <Badge color="amber">{count}</Badge>
      </div>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        {t('pendingRequestsCount', { count })}
      </p>
    </Link>
  );
}
