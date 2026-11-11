'use server';

/** Gates administrator resets and exposes the generated credential only to the authorized caller.
 * The response retains its credential type; audit messages never include the password. */
import { UserId } from '@/domain/shared/EntityIds';
import { UserDomainCodes } from '@/domain/user/UserDomainCodes';

import {
  prisma,
  PrismaUserRepository,
  PrismaSessionRepository,
  Argon2PasswordHasher,
  CryptoPasswordGenerator,
} from '@/infrastructure/index';
import {
  ResetUserPasswordUseCase,
  ResetUserPasswordResult,
} from '@/application/auth/ResetUserPasswordUseCase';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { requireSuperadmin } from '@/src/web/actions/superadmin/superadminAuth';
import { isError } from '@/src/web/actions/superadmin/superadminAuthUtils';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function resetUserPasswordAction(input: {
  userId: string;
}): Promise<ActionResult<ResetUserPasswordResult>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const auth = await requireSuperadmin();

  if (isError(auth)) {
    return auth;
  }

  const useCase = new ResetUserPasswordUseCase({
    userRepository: new PrismaUserRepository(prisma),
    sessionRepository: new PrismaSessionRepository(prisma),
    passwordHasher: new Argon2PasswordHasher(),
    passwordGenerator: new CryptoPasswordGenerator(),
  });

  const userId = UserId.safeParse(input.userId);

  if (!userId.success) {
    return {
      success: false,
      error: await translateErrorCode(UserDomainCodes.USER_NOT_FOUND),
    };
  }

  const result = await useCase.execute({ userId: userId.data });

  if (!result.success) {
    return { success: false, error: await translateErrorCode(result.error) };
  }

  // Audit trail. The generated password is deliberately absent — it travels
  // to the superadmin's screen and nowhere else.
  console.log(
    `[UserPasswordReset] ${new Date().toISOString()} userId=${input.userId} by superadmin=${auth.userId}`
  );

  return { success: true, data: { password: result.value.password } };
}
