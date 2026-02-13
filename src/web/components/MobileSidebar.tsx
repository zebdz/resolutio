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
  BellIcon,
} from '@heroicons/react/20/solid';
import { Badge } from '@/app/components/catalyst/badge';
import { LocaleSwitcher } from './LocaleSwitcher';

interface MobileSidebarProps {
  isSuperAdmin: boolean;
  unreadNotificationCount: number;
}

function isItemCurrent(itemHref: string, pathname: string): boolean {
  // Remove locale prefix from pathname
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');

  if (itemHref === '/home') {
    return pathWithoutLocale === '/home';
  }

  return pathWithoutLocale.startsWith(itemHref);
}

export function MobileSidebar({
  isSuperAdmin,
  unreadNotificationCount,
}: MobileSidebarProps) {
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
            href="/notifications"
            current={isItemCurrent('/notifications', pathname)}
          >
            <BellIcon data-slot="icon" />
            <SidebarLabel>
              {t('notifications')}
              {unreadNotificationCount > 0 && (
                <Badge color="red" className="ml-2">
                  {unreadNotificationCount > 99
                    ? '99+'
                    : unreadNotificationCount}
                </Badge>
              )}
            </SidebarLabel>
          </SidebarItem>
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
