import { cookies } from 'next/headers';
import {
  prisma,
  PrismaSessionRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import type { User } from '@/domain/user/User';

const SESSION_COOKIE_NAME = 'session';
const SESSION_COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 days in seconds

export async function setSessionCookie(sessionId: string): Promise<void> {
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, sessionId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_COOKIE_MAX_AGE,
    path: '/',
  });
}

export async function getSessionCookie(): Promise<string | undefined> {
  const cookieStore = await cookies();

  return cookieStore.get(SESSION_COOKIE_NAME)?.value;
}

export async function deleteSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function getCurrentUser(): Promise<User | null> {
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
    if (session.expiresAt < new Date()) {
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
}
