'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/src/i18n/routing';
import {
  Navbar,
  NavbarItem,
  NavbarSection,
  NavbarSpacer,
  NavbarLabel,
} from '@/app/components/catalyst/navbar';
import {
  BuildingOffice2Icon,
  ChartBarIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  BellIcon,
} from '@heroicons/react/20/solid';
import { Badge } from '@/app/components/catalyst/badge';
import { LocaleSwitcher } from './LocaleSwitcher';

interface AppNavbarProps {
  isSuperAdmin: boolean;
  unreadNotificationCount: number;
}

function isItemCurrent(itemHref: string, pathname: string): boolean {
  // Remove locale prefix from pathname (e.g., /en/organizations -> /organizations)
  const pathWithoutLocale = pathname.replace(/^\/[a-z]{2}(?=\/|$)/, '');

  if (itemHref === '/home') {
    return pathWithoutLocale === '/home';
  }

  return pathWithoutLocale.startsWith(itemHref);
}

export function AppNavbar({
  isSuperAdmin,
  unreadNotificationCount,
}: AppNavbarProps) {
  const t = useTranslations('navbar');
  const pathname = usePathname();

  return (
    <Navbar>
      <NavbarSection>
        <NavbarItem href="/home" current={isItemCurrent('/home', pathname)}>
          <NavbarLabel className="font-bold">{t('logo')}</NavbarLabel>
        </NavbarItem>
      </NavbarSection>

      <NavbarSection className="max-lg:hidden">
        <NavbarItem
          href="/organizations"
          current={isItemCurrent('/organizations', pathname)}
        >
          <BuildingOffice2Icon data-slot="icon" />
          <NavbarLabel>{t('organizations')}</NavbarLabel>
        </NavbarItem>
        <NavbarItem href="/polls" current={isItemCurrent('/polls', pathname)}>
          <ChartBarIcon data-slot="icon" />
          <NavbarLabel>{t('polls')}</NavbarLabel>
        </NavbarItem>
        {isSuperAdmin && (
          <NavbarItem href="/admin" current={isItemCurrent('/admin', pathname)}>
            <ShieldCheckIcon data-slot="icon" />
            <NavbarLabel>{t('admin')}</NavbarLabel>
          </NavbarItem>
        )}
      </NavbarSection>

      <NavbarSpacer />

      <NavbarSection>
        <NavbarItem
          href="/notifications"
          current={isItemCurrent('/notifications', pathname)}
          aria-label={t('notifications')}
        >
          <div className="relative" data-slot="icon">
            <BellIcon className="size-full" />
            {unreadNotificationCount > 0 && (
              <Badge
                color="red"
                className="absolute -top-1.5 -right-2.5 min-w-[1.25rem] justify-center px-1 py-0 text-[10px]"
              >
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </Badge>
            )}
          </div>
        </NavbarItem>
        <NavbarItem
          href="/account"
          current={isItemCurrent('/account', pathname)}
        >
          <UserCircleIcon data-slot="icon" />
          <NavbarLabel className="max-lg:hidden">{t('account')}</NavbarLabel>
        </NavbarItem>
        <LocaleSwitcher />
      </NavbarSection>
    </Navbar>
  );
}
