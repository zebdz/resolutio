/** Results read endpoints enforce the same account setup and moderation gates
 * as the authenticated layout without involving React Server Component rendering. */
import { getUserModerationAccess } from '@/application/user/getUserModerationAccess';
import { success, failure } from '@/domain/shared/Result';
import type { User } from '@/domain/user/User';
import { prisma } from '@/infrastructure/database/prisma';
import { PrismaUserModerationRepository } from '@/infrastructure/repositories/PrismaUserModerationRepository';

const moderation = new PrismaUserModerationRepository(prisma);

export async function resultsViewerAccess(user: User) {
  if (!user.isConfirmed()) {
    return failure({
      code: 'auth.errors.accountNotConfirmed',
      status: 403,
      next: '/confirm-phone',
    } as const);
  }

  if (!user.privacySetupCompleted) {
    return failure({
      code: 'seal.errors.forbidden',
      status: 403,
      next: '/privacy-setup',
    } as const);
  }

  const access = await getUserModerationAccess(moderation, user.id);

  if (!access.success) {
    return failure({
      code: access.error,
      status: 500,
      next: undefined,
    } as const);
  }

  if (access.value === 'blocked') {
    return failure({
      code: 'seal.errors.forbidden',
      status: 403,
      next: '/blocked',
    } as const);
  }

  return success(undefined);
}
