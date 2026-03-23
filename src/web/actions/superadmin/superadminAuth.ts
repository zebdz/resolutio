'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser, getSessionCookie } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { getClientIp } from '@/web/lib/clientIp';
import { registerSuperadminAccess } from '@/infrastructure/rateLimit/superadminWhitelist';
import type { SuperadminAuthResult } from './superadminAuthUtils';

const userRepository = new PrismaUserRepository(prisma);

export async function requireSuperadmin(): Promise<SuperadminAuthResult> {
  const t = await getTranslations('common.errors');
  const user = await getCurrentUser();

  if (!user) {
    return { success: false, error: t('unauthorized') };
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  if (!isSuperAdmin) {
    return { success: false, error: t('unauthorized') };
  }

  // Whitelist this superadmin's IP+session so they bypass rate limiting
  const ip = await getClientIp();
  const sessionId = await getSessionCookie();
  registerSuperadminAccess(ip, user.id, sessionId!);

  return { userId: user.id };
}
