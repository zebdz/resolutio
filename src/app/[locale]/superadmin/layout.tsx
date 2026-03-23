import { redirect } from 'next/navigation';
import { getCurrentUser, getSessionCookie } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { registerSuperadminAccess } from '@/infrastructure/rateLimit/superadminWhitelist';
import { getClientIp } from '@/web/lib/clientIp';

const userRepository = new PrismaUserRepository(prisma);

export default async function SuperadminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  if (!isSuperAdmin) {
    redirect('/home');
  }

  // Refresh rate-limit whitelist on every superadmin page visit
  const ip = await getClientIp();
  const sessionId = await getSessionCookie();

  if (sessionId) {
    registerSuperadminAccess(ip, user.id, sessionId);
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
