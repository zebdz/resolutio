/** Recipient inbox page preserves typed successful reads and displays localized failures.
 * An unavailable read is distinct from a successful empty notification list. */
import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { getNotificationsAction } from '@/src/web/actions/notification/notification';
import { NotificationsList } from './NotificationsList';
import { NOTIFICATIONS_PAGE_SIZE } from './constants';

export default async function NotificationsPage() {
  const t = await getTranslations('notification.page');

  const result = await getNotificationsAction(NOTIFICATIONS_PAGE_SIZE);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        {result.success ? (
          <NotificationsList
            initialNotifications={result.data.notifications}
            initialUnreadCount={result.data.unreadCount}
            initialTotalCount={result.data.totalCount}
          />
        ) : (
          <div role="alert">{result.error}</div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
