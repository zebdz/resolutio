import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';
import { getNotificationsAction } from '@/web/actions/notification';
import { NotificationsList } from './NotificationsList';
import { NOTIFICATIONS_PAGE_SIZE } from './constants';

export default async function NotificationsPage() {
  const t = await getTranslations('notification.page');

  const result = await getNotificationsAction(NOTIFICATIONS_PAGE_SIZE);

  const notifications = result.success ? result.data.notifications : [];
  const unreadCount = result.success ? result.data.unreadCount : 0;
  const totalCount = result.success ? result.data.totalCount : 0;

  return (
    <AuthenticatedLayout>
      <div className="space-y-6">
        <Heading className="text-3xl font-bold">{t('title')}</Heading>
        <NotificationsList
          initialNotifications={notifications}
          initialUnreadCount={unreadCount}
          initialTotalCount={totalCount}
        />
      </div>
    </AuthenticatedLayout>
  );
}
