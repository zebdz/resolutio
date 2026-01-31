import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/web/lib/session';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { StackedLayout } from '@/app/components/catalyst/stacked-layout';
import { AppNavbar } from './AppNavbar';
import { MobileSidebar } from './MobileSidebar';

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

const userRepository = new PrismaUserRepository(prisma);

export async function AuthenticatedLayout({
  children,
}: AuthenticatedLayoutProps) {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  return (
    <StackedLayout
      navbar={<AppNavbar isSuperAdmin={isSuperAdmin} />}
      sidebar={<MobileSidebar isSuperAdmin={isSuperAdmin} />}
    >
      {children}
    </StackedLayout>
  );
}
