/** Render the same desktop and mobile navigation for protected pages and optional-session pages. */
import type { MemberNavigation } from '@/web/lib/MemberNavigation';
import { StackedLayout } from '@/src/web/components/catalyst/stacked-layout';
import { AppNavbar } from './AppNavbar';
import { MobileSidebar } from './MobileSidebar';
import { GuestNavbar } from './GuestNavbar';

export function SiteLayout({
  member,
  children,
}: React.PropsWithChildren<{ member: MemberNavigation | null }>) {
  return (
    <StackedLayout
      navbar={member ? <AppNavbar {...member} /> : <GuestNavbar />}
      sidebar={member && <MobileSidebar {...member} />}
    >
      {children}
    </StackedLayout>
  );
}
