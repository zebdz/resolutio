import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { StackedLayout } from '@/app/components/catalyst/stacked-layout';
import { AppNavbar } from './AppNavbar';
import { MobileSidebar } from './MobileSidebar';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);

export async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Force privacy gate for users who haven't completed setup
  if (!user.privacySetupCompleted) {
    redirect('/privacy-setup');
  }

  const [isSuperAdmin, isBlocked, unreadNotificationCount] = await Promise.all([
    userRepository.isSuperAdmin(user.id),
    userRepository.isUserBlocked(user.id),
    notificationRepository.getUnreadCount(user.id),
  ]);

  if (isBlocked) {
    redirect('/blocked');
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
