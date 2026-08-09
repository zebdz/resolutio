import { redirectLocalized } from '@/web/lib/redirectLocalized';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { StackedLayout } from '@/src/web/components/catalyst/stacked-layout';
import { AppNavbar } from './AppNavbar';
import { MobileSidebar } from './MobileSidebar';
import { getLocale } from 'next-intl/server';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirectLocalized(await getLocale(), '/login');
  }

  // Force confirmation gate for unconfirmed users
  if (!user.isConfirmed()) {
    redirectLocalized(await getLocale(), '/confirm-phone');
  }

  // Force privacy gate for users who haven't completed setup
  if (!user.privacySetupCompleted) {
    redirectLocalized(await getLocale(), '/privacy-setup');
  }

  const userRepository = new PrismaUserRepository(prisma);
  const notificationRepository = new PrismaNotificationRepository(prisma);

  const [isSuperAdmin, isBlocked, unreadNotificationCount] = await Promise.all([
    userRepository.isSuperAdmin(user.id),
    userRepository.isUserBlocked(user.id),
    notificationRepository.getUnreadCount(user.id),
  ]);

  if (isBlocked) {
    redirectLocalized(await getLocale(), '/blocked');
  }

  return (
    <StackedLayout
      navbar={
        <AppNavbar
          isSuperAdmin={isSuperAdmin}
          unreadNotificationCount={unreadNotificationCount}
        />
      }
      sidebar={
        <MobileSidebar
          isSuperAdmin={isSuperAdmin}
          unreadNotificationCount={unreadNotificationCount}
        />
      }
    >
      {children}
    </StackedLayout>
  );
}
