/** Resolve site navigation for the current session. Protected pages enforce the
 * returned gate; optional headers on public pages can render guest navigation. */
import { getUserModerationAccess } from '@/application/user/getUserModerationAccess';
import { PrismaUserModerationRepository } from '@/infrastructure/repositories/PrismaUserModerationRepository';
import { PrismaNotificationReader } from '@/infrastructure/repositories/PrismaNotificationReader';
import { GetUnreadNotificationCountUseCase } from '@/application/notification/GetUnreadNotificationCountUseCase';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { type Result, success } from '@/domain/shared/Result';
import type { NotificationFailure } from '@/application/notification/NotificationErrors';
import type { MemberNavigation } from './MemberNavigation';

type Gate = {
  redirect: '/login' | '/confirm-phone' | '/privacy-setup' | '/blocked';
};

export async function getSiteNavigation(): Promise<
  Result<MemberNavigation | Gate, NotificationFailure>
> {
  const user = await getCurrentUser();

  if (!user) {
    return success({ redirect: '/login' });
  }

  // Force confirmation gate for unconfirmed users
  if (!user.isConfirmed()) {
    return success({ redirect: '/confirm-phone' });
  }

  // Force privacy gate for users who haven't completed setup
  if (!user.privacySetupCompleted) {
    return success({ redirect: '/privacy-setup' });
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
    return access;
  }

  if (access.value === 'blocked') {
    return success({ redirect: '/blocked' });
  }

  if (!unreadNotificationCount.success) {
    return unreadNotificationCount;
  }

  return success({
    isSuperAdmin,
    unreadNotificationCount: unreadNotificationCount.value.count,
    firstName: user.firstName,
  });
}
