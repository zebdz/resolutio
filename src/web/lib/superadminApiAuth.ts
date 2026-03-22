import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';

const userRepository = new PrismaUserRepository(prisma);

/**
 * Superadmin auth check for API routes.
 * Does NOT use next-intl getTranslations (unavailable in API routes).
 * Returns null if authorized, or a NextResponse error if not.
 */
export async function requireSuperadminApi(): Promise<{
  userId: string;
  error: NextResponse | null;
}> {
  const user = await getCurrentUser();

  if (!user) {
    return {
      userId: '',
      error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    };
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  if (!isSuperAdmin) {
    return {
      userId: '',
      error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }),
    };
  }

  return { userId: user.id, error: null };
}
