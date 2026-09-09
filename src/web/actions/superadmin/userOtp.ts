'use server';

import {
  prisma,
  PrismaUserRepository,
  PrismaOtpRepository,
} from '@/infrastructure/index';
import { ResetUserOtpUseCase } from '@/application/auth/ResetUserOtpUseCase';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { requireSuperadmin } from '@/src/web/actions/superadmin/superadminAuth';
import { isError } from '@/src/web/actions/superadmin/superadminAuthUtils';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import type { ActionResult } from './userPassword';

// Clears every confirmation code issued to a user, which restarts the
// per-address throttle: for someone stuck behind a long wait after too many
// codes, this is what lets the next one go out.
export async function resetUserOtpAction(input: {
  userId: string;
}): Promise<ActionResult<{ deleted: number }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const useCase = new ResetUserOtpUseCase({
    userRepository: new PrismaUserRepository(prisma),
    otpRepository: new PrismaOtpRepository(prisma),
  });

  const result = await useCase.execute({ userId: input.userId });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  // Audit trail: who cleared whose codes, and how many went.
  console.log(
    `[UserOtpReset] ${new Date().toISOString()} userId=${input.userId} deleted=${result.value.deleted} by superadmin=${auth.userId}`
  );

  return { success: true, data: { deleted: result.value.deleted } };
}
