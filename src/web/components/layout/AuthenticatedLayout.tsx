/** Authenticated shell enforces setup/moderation gates before rendering protected children.
 * Moderation and unread-count failures display explicit localized errors before rendering the shell. */
import { redirectLocalized } from '@/web/lib/redirectLocalized';
import { getUserModerationAccess } from '@/application/user/getUserModerationAccess';
import { PrismaUserModerationRepository } from '@/infrastructure/repositories/PrismaUserModerationRepository';
import { PrismaNotificationReader } from '@/infrastructure/repositories/PrismaNotificationReader';
import { GetUnreadNotificationCountUseCase } from '@/application/notification/GetUnreadNotificationCountUseCase';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
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
  const unreadCount = new GetUnreadNotificationCountUseCase({
    notificationReader: new PrismaNotificationReader(prisma),
  });

  const [isSuperAdmin, access, unreadNotificationCount] = await Promise.all([
    userRepository.isSuperAdmin(user.id),
    getUserModerationAccess(
      new PrismaUserModerationRepository(prisma),
      user.id
    ),
    unreadCount.execute({ userId: user.id }),
  ]);

  if (!access.success) {
    return <div role="alert">{await translateErrorCode(access.error)}</div>;
  }

  if (access.value === 'blocked') {
    redirectLocalized(await getLocale(), '/blocked');
  }

  if (!unreadNotificationCount.success) {
    return (
      <div role="alert">
        {await translateErrorCode(unreadNotificationCount.error)}
      </div>
    );
  }

  return (
    <StackedLayout
      navbar={
        <AppNavbar
          isSuperAdmin={isSuperAdmin}
          unreadNotificationCount={unreadNotificationCount.value.count}
          firstName={user.firstName}
        />
      }
      sidebar={
        <MobileSidebar
          isSuperAdmin={isSuperAdmin}
          unreadNotificationCount={unreadNotificationCount.value.count}
          firstName={user.firstName}
        />
      }
    >
      {children}
    </StackedLayout>
  );
}
