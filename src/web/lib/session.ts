/** Validates session cookies before repository access and resolves authenticated users.
 * Browser values stay transport data until parsed into the session identity. */
import { cache } from 'react';
import { SessionId } from '@/domain/shared/EntityIds';
import { Seconds } from '@/domain/auth/AuthValues';
import { SystemClock } from '@/infrastructure/shared/SystemEntityCreation';
import { cookies } from 'next/headers';
import {
  prisma,
  PrismaSessionRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import type { User } from '@/domain/user/User';

const SESSION_COOKIE_NAME = 'session';

export async function setSessionCookie(
  sessionId: SessionId,
  maxAgeSeconds: Seconds
): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: maxAgeSeconds,
    path: '/',
  });
}

export async function getSessionCookie(): Promise<SessionId | undefined> {
  const cookieStore = await cookies();

  const parsed = SessionId.safeParse(
    cookieStore.get(SESSION_COOKIE_NAME)?.value
  );

  return parsed.success ? parsed.data : undefined;
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export const getCurrentUser = cache(async (): Promise<User | null> => {
  try {
    const sessionId = await getSessionCookie();

    if (!sessionId) {
      return null;
    }

    const sessionRepository = new PrismaSessionRepository(prisma);
    const userRepository = new PrismaUserRepository(prisma);

    // Get session
    const session = await sessionRepository.findById(sessionId);

    if (!session) {
      return null;
    }

    // Check if session is expired
    if (session.isExpired(new SystemClock().now())) {
      await sessionRepository.delete(sessionId);

      return null;
    }

    // Get user
    const user = await userRepository.findById(session.userId);

    return user;
  } catch (error) {
    console.error('Error getting current user:', error);

    // Silently fail for database connection issues
    // User will be treated as not logged in
    return null;
  }
});
