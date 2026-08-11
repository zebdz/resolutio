'use server';

import {
  prisma,
  PrismaUserRepository,
  PrismaSessionRepository,
  Argon2PasswordHasher,
  CryptoPasswordGenerator,
} from '@/infrastructure/index';
import { ResetUserPasswordUseCase } from '@/application/auth/ResetUserPasswordUseCase';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { requireSuperadmin } from '@/src/web/actions/superadmin/superadminAuth';
import { isError } from '@/src/web/actions/superadmin/superadminAuthUtils';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function resetUserPasswordAction(input: {
  userId: string;
}): Promise<ActionResult<{ password: string }>> {
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

  const result = await useCase.execute({ userId: input.userId });

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
