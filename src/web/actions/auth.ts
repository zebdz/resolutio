'use server';

import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getTranslations } from 'next-intl/server';
import { RegisterUserUseCase } from '@/application/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '@/application/auth/LoginUserUseCase';
import { LogoutUserUseCase } from '@/application/auth/LogoutUserUseCase';
import { Locale, defaultLocale } from '@/src/i18n/locales';
import {
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
} from '@/domain/user/User';
import {
  prisma,
  PrismaUserRepository,
  PrismaSessionRepository,
  PrismaOtpRepository,
  Argon2PasswordHasher,
  Argon2PasswordVerifier,
  OtpCodeHasherImpl,
  StubSmsOtpDeliveryChannel,
  TurnstileCaptchaVerifier,
} from '@/infrastructure/index';
import {
  setSessionCookie,
  getSessionCookie,
  deleteSessionCookie,
} from '../lib/session';
import { registerUserSchema } from '@/application/auth/RegisterUserSchema';
import { LoginUserSchema } from '@/application/auth/LoginUserSchema';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { AuthErrors } from '@/application/auth/AuthErrors';
import {
  checkRateLimit,
  checkLoginRateLimit,
  checkRegistrationRateLimit,
  recordFailedLogin,
  resetLoginRateLimit,
} from '@/web/actions/rateLimit';
import { getClientIp } from '@/web/lib/clientIp';
import { registerSuperadminAccess } from '@/infrastructure/rateLimit/superadminWhitelist';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

// Helper function to check if error is a Prisma connection error
function isDatabaseConnectionError(error: unknown): boolean {
  if (!error) {
    return false;
  }

  // Check error message
  const errorMessage = error instanceof Error ? error.message : String(error);

  if (
    errorMessage.includes('Connection terminated') ||
    errorMessage.includes("Can't reach database") ||
    errorMessage.includes('Connection refused') ||
    errorMessage.includes('ECONNREFUSED') ||
    errorMessage.includes('timeout')
  ) {
    return true;
  }

  // Check Prisma error codes
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const prismaError = error as { code?: string };

    return (
      prismaError.code === 'P1001' || // Can't reach database server
      prismaError.code === 'P1002' || // Database server timeout
      prismaError.code === 'P1008' || // Operations timed out
      prismaError.code === 'P1017'
    ); // Server has closed the connection
  }

  return false;
}

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const userRepository = new PrismaUserRepository(prisma);
const sessionRepository = new PrismaSessionRepository(prisma);
const otpRepository = new PrismaOtpRepository(prisma);
const passwordHasher = new Argon2PasswordHasher();
const passwordVerifier = new Argon2PasswordVerifier();
const otpCodeHasher = new OtpCodeHasherImpl(
  process.env.OTP_CODE_SECRET || 'dev-otp-secret'
);
const deliveryChannel = new StubSmsOtpDeliveryChannel();

const captchaVerifier = new TurnstileCaptchaVerifier(
  process.env.TURNSTILE_SECRET_KEY || ''
);
const profanityChecker = LeoProfanityChecker.getInstance();

// Use cases
const registerUserUseCase = new RegisterUserUseCase({
  userRepository,
  passwordHasher,
  otpRepository,
  sessionRepository,
  otpCodeHasher,
  deliveryChannel,
  profanityChecker,
  expiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
});
const loginUserUseCase = new LoginUserUseCase({
  userRepository,
  sessionRepository,
  passwordVerifier,
  otpRepository,
  otpCodeHasher,
  deliveryChannel,
  otpExpiryMinutes: parseInt(process.env.OTP_EXPIRY_MINUTES || '10', 10),
});
const logoutUserUseCase = new LogoutUserUseCase(sessionRepository);

export interface RegisterActionData {
  userId: string;
  otpId: string;
  expiresAt: string;
  backdoorCode?: string;
  expiresInSeconds: number;
}

export async function registerAction(
  formData: FormData
): Promise<ActionResult<RegisterActionData>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const clientIp = await getClientIp();
  const regRateLimited = await checkRegistrationRateLimit(clientIp);

  if (regRateLimited) {
    return regRateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Extract form data
    const input = {
      firstName: formData.get('firstName') as string,
      lastName: formData.get('lastName') as string,
      middleName: (formData.get('middleName') as string) || undefined,
      phoneNumber: formData.get('phoneNumber') as string,
      password: formData.get('password') as string,
      confirmPassword: formData.get('confirmPassword') as string,
      language: (formData.get('language') as Locale) || defaultLocale,
      consentGiven: formData.get('consentGiven') === 'true',
    };

    // Validate with Zod
    const validation = registerUserSchema(profanityChecker).safeParse(input);

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues,
        {
          minLength: NAME_MIN_LENGTH,
          maxLength: NAME_MAX_LENGTH,
        }
      );

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case (remove confirmPassword as it's not in the use case input)
    const { confirmPassword, ...registerInput } = validation.data;
    const userAgent = (await headers()).get('user-agent') ?? undefined;

    let result;

    try {
      result = await registerUserUseCase.execute({
        ...registerInput,
        clientIp,
        ipAddress: clientIp,
        userAgent,
      });
    } catch (useCaseError) {
      // Check if it's a database connection error
      if (isDatabaseConnectionError(useCaseError)) {
        return {
          success: false,
          error: t('databaseConnection'),
        };
      }

      throw useCaseError; // Re-throw to be caught by outer catch
    }

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    // Set session cookie
    await setSessionCookie(
      result.value.session.id,
      result.value.expiresInSeconds
    );

    return {
      success: true,
      data: {
        userId: result.value.user.id,
        otpId: result.value.otpId,
        expiresAt: result.value.expiresAt.toISOString(),
        backdoorCode: result.value.backdoorCode,
        expiresInSeconds: result.value.expiresInSeconds,
      },
    };
  } catch (error) {
    console.error('Register action error:', error);

    // Check for database connection errors
    if (isDatabaseConnectionError(error)) {
      return {
        success: false,
        error: t('databaseConnection'),
      };
    }

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export interface LoginActionData {
  userId: string;
  needsConfirmation?: true;
  otpId?: string;
  expiresAt?: string;
  backdoorCode?: string;
}

export async function loginAction(
  formData: FormData
): Promise<ActionResult<LoginActionData>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Extract form data
    const input = {
      phoneNumber: formData.get('phoneNumber') as string,
      password: formData.get('password') as string,
    };

    // Validate with Zod
    const validation = LoginUserSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues
      );

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Verify CAPTCHA
    const clientIp = await getClientIp();
    const captchaToken = formData.get('captchaToken') as string;

    if (captchaToken) {
      const captchaValid = await captchaVerifier.verify(captchaToken, clientIp);

      if (!captchaValid) {
        return { success: false, error: t('captchaFailed') };
      }
    }

    // Check login rate limit (per IP+phone)
    const loginRateLimited = await checkLoginRateLimit(
      validation.data.phoneNumber,
      clientIp
    );

    if (loginRateLimited) {
      return loginRateLimited;
    }

    // Execute use case
    const userAgent = (await headers()).get('user-agent') ?? undefined;
    let result;

    try {
      result = await loginUserUseCase.execute({
        ...validation.data,
        ipAddress: clientIp,
        userAgent,
      });
    } catch (useCaseError) {
      // Check if it's a database connection error
      if (isDatabaseConnectionError(useCaseError)) {
        return {
          success: false,
          error: t('databaseConnection'),
        };
      }

      throw useCaseError; // Re-throw to be caught by outer catch
    }

    if (!result.success) {
      if (result.error === AuthErrors.INVALID_CREDENTIALS) {
        await recordFailedLogin(validation.data.phoneNumber, clientIp);
      }

      return { success: false, error: await translateErrorCode(result.error) };
    }

    // Reset login rate limit on success
    await resetLoginRateLimit(validation.data.phoneNumber, clientIp);

    // Set session cookie
    await setSessionCookie(
      result.value.session.id,
      result.value.expiresInSeconds
    );

    // Register superadmin whitelist on login (so they bypass rate limits immediately)
    if (await userRepository.isSuperAdmin(result.value.user.id)) {
      registerSuperadminAccess(
        clientIp,
        result.value.user.id,
        result.value.session.id
      );
    }

    // Build response data
    const data: LoginActionData = {
      userId: result.value.user.id,
    };

    if (result.value.needsConfirmation) {
      data.needsConfirmation = true;
      data.otpId = result.value.otpId;
      data.expiresAt = result.value.expiresAt?.toISOString();
      data.backdoorCode = result.value.backdoorCode;
    }

    return {
      success: true,
      data,
    };
  } catch (error) {
    console.error('Login action error:', error);

    // Check for database connection errors
    if (isDatabaseConnectionError(error)) {
      return {
        success: false,
        error: t('databaseConnection'),
      };
    }

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}

export async function logoutAction(): Promise<void> {
  try {
    // Get session from cookie
    const sessionId = await getSessionCookie();

    if (sessionId) {
      // Execute use case
      await logoutUserUseCase.execute(sessionId);

      // Delete cookie
      await deleteSessionCookie();
    }
  } catch (error) {
    console.error('Logout action error:', error);
    // Still delete cookie even if logout fails
    await deleteSessionCookie();
  }

  // Redirect to home page
  redirect('/');
}
