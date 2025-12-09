import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from '@/web/lib/session';
import { PrismaSessionRepository } from '@/infrastructure/repositories/PrismaSessionRepository';
import { prisma } from '@/infrastructure/database/prisma';

const sessionRepository = new PrismaSessionRepository(prisma);

// Public routes that don't require authentication
const publicRoutes = ['/', '/login', '/register'];

export async function authMiddleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public routes
  if (publicRoutes.some((route) => pathname.startsWith(route))) {
    return NextResponse.next();
  }

  // Check for session cookie
  const sessionId = await getSessionCookie();

  if (!sessionId) {
    // No session, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);

    return NextResponse.redirect(loginUrl);
  }

  // Validate session
  const session = await sessionRepository.findById(sessionId);

  if (!session) {
    // Invalid session, redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);

    return NextResponse.redirect(loginUrl);
  }

  // Check if session expired
  if (session.expiresAt < new Date()) {
    // Expired session, clean up and redirect
    await sessionRepository.delete(sessionId);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);

    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}
