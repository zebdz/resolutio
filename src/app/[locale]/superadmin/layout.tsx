import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

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

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
