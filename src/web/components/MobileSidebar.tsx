'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/src/i18n/routing';
import {
  Sidebar,
  SidebarBody,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/app/components/catalyst/sidebar';
import {
  BuildingOffice2Icon,
  ChartBarIcon,
  ShieldCheckIcon,
  UserCircleIcon,
} from '@heroicons/react/20/solid';
import { LocaleSwitcher } from './LocaleSwitcher';

interface MobileSidebarProps {
  isSuperAdmin: boolean;
}

function isItemCurrent(itemHref: string, pathname: string): boolean {
  // Remove locale prefix from pathname
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');

  if (itemHref === '/home') {
    return pathWithoutLocale === '/home';
  }
  return pathWithoutLocale.startsWith(itemHref);
}

export function MobileSidebar({ isSuperAdmin }: MobileSidebarProps) {
  const t = useTranslations('navbar');
  const pathname = usePathname();

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarSection>
          <SidebarItem href="/home" current={isItemCurrent('/home', pathname)}>
            <SidebarLabel className="font-bold">{t('logo')}</SidebarLabel>
          </SidebarItem>
        </SidebarSection>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          <SidebarItem
            href="/organizations"
            current={isItemCurrent('/organizations', pathname)}
          >
            <BuildingOffice2Icon data-slot="icon" />
            <SidebarLabel>{t('organizations')}</SidebarLabel>
          </SidebarItem>
          <SidebarItem
            href="/polls"
            current={isItemCurrent('/polls', pathname)}
          >
            <ChartBarIcon data-slot="icon" />
            <SidebarLabel>{t('polls')}</SidebarLabel>
          </SidebarItem>
          {isSuperAdmin && (
            <SidebarItem
              href="/admin"
              current={isItemCurrent('/admin', pathname)}
            >
              <ShieldCheckIcon data-slot="icon" />
              <SidebarLabel>{t('admin')}</SidebarLabel>
            </SidebarItem>
          )}
        </SidebarSection>

        <SidebarSection>
          <SidebarItem
            href="/account"
            current={isItemCurrent('/account', pathname)}
          >
            <UserCircleIcon data-slot="icon" />
            <SidebarLabel>{t('account')}</SidebarLabel>
          </SidebarItem>
        </SidebarSection>

        <div className="px-2 mt-4">
          <LocaleSwitcher />
        </div>
      </SidebarBody>
    </Sidebar>
  );
}
