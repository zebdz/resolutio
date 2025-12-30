'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { RegisterUserUseCase } from '@/application/auth/RegisterUserUseCase';
import { LoginUserUseCase } from '@/application/auth/LoginUserUseCase';
import { LogoutUserUseCase } from '@/application/auth/LogoutUserUseCase';
import { Locale, defaultLocale } from '@/src/i18n/locales';
import {
  prisma,
  PrismaUserRepository,
  PrismaSessionRepository,
  Argon2PasswordHasher,
  Argon2PasswordVerifier,
} from '@/infrastructure/index';
import {
  setSessionCookie,
  getSessionCookie,
  deleteSessionCookie,
} from '../lib/session';
import { RegisterUserSchema } from '@/application/auth/RegisterUserSchema';
import { LoginUserSchema } from '@/application/auth/LoginUserSchema';
import { UnauthorizedError, DuplicateError } from '@/domain/shared/errors';

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
const passwordHasher = new Argon2PasswordHasher();
const passwordVerifier = new Argon2PasswordVerifier();

// Use cases
const registerUserUseCase = new RegisterUserUseCase(
  userRepository,
  passwordHasher
);
const loginUserUseCase = new LoginUserUseCase(
  userRepository,
  sessionRepository,
  passwordVerifier
);
const logoutUserUseCase = new LogoutUserUseCase(sessionRepository);

export async function registerAction(
  formData: FormData
): Promise<ActionResult<{ userId: string }>> {
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
    };

    // Validate with Zod
    const validation = RegisterUserSchema.safeParse(input);
    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case (remove confirmPassword as it's not in the use case input)

    const { confirmPassword, ...registerInput } = validation.data;

    let result;
    try {
      result = await registerUserUseCase.execute(registerInput);
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
      // Handle specific error types
      if (result.error instanceof DuplicateError) {
        return {
          success: false,
          error: t('phoneExists'),
        };
      }

      return {
        success: false,
        error: result.error.message,
      };
    }

    return {
      success: true,
      data: { userId: result.value.id },
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

export async function loginAction(
  formData: FormData
): Promise<ActionResult<{ userId: string }>> {
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
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');
        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case
    let result;
    try {
      result = await loginUserUseCase.execute(validation.data);
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
      // Check if the error is a database connection error
      if (isDatabaseConnectionError(result.error)) {
        return {
          success: false,
          error: t('databaseConnection'),
        };
      }

      // Handle specific error types
      if (result.error instanceof UnauthorizedError) {
        return {
          success: false,
          error: t('invalidCredentials'),
        };
      }

      return {
        success: false,
        error: result.error.message,
      };
    }

    // Set session cookie
    await setSessionCookie(result.value.session.id);

    return {
      success: true,
      data: { userId: result.value.user.id },
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

// Helper function to get current user from session
export async function getCurrentUser(): Promise<{
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
} | null> {
  try {
    const sessionId = await getSessionCookie();

    if (!sessionId) {
      return null;
    }

    // Find session
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      // Invalid session, clean up cookie
      await deleteSessionCookie();

      return null;
    }

    // Check if session expired
    if (session.expiresAt < new Date()) {
      // Expired session, clean up
      await sessionRepository.delete(sessionId);
      await deleteSessionCookie();

      return null;
    }

    // Get user
    const user = await userRepository.findById(session.userId);

    if (!user) {
      // User not found, clean up session
      await sessionRepository.delete(sessionId);
      await deleteSessionCookie();

      return null;
    }

    return {
      id: user.id,
      firstName: user.firstName,
      lastName: user.lastName,
      phoneNumber: user.phoneNumber.getValue(),
    };
  } catch (error) {
    console.error('Get current user error:', error);

    return null;
  }
}
