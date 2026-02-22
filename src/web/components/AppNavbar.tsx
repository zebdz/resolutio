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
} from '@heroicons/react/20/solid';
import { BellIcon } from '@heroicons/react/24/outline';
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
            <BellIcon className="size-full stroke-2" />
            {unreadNotificationCount > 0 && (
              <span className="absolute -top-3 -right-3 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[11px] font-bold leading-none text-white ring-2 ring-white dark:ring-zinc-900">
                {unreadNotificationCount > 99 ? '99+' : unreadNotificationCount}
              </span>
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
