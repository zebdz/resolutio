'use client';

import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Link } from '@/src/i18n/routing';
import {
  Sidebar,
  SidebarBody,
  SidebarFooter,
  SidebarHeader,
  SidebarItem,
  SidebarLabel,
  SidebarSection,
} from '@/src/web/components/catalyst/sidebar';
import {
  BuildingOffice2Icon,
  ChartBarIcon,
  HomeIcon,
  ShieldCheckIcon,
  UserCircleIcon,
  BellIcon,
} from '@heroicons/react/20/solid';
import { LocaleSwitcher } from './LocaleSwitcher';
import { getVersion } from '@/src/web/lib/version';

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
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-3 px-2 py-1"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/logo-icon.svg"
              alt="Organization logo"
              className="h-10 w-auto"
            />
            <span className="flex flex-col text-xs font-bold uppercase leading-relaxed tracking-wider text-white/90">
              {t('logoText')
                .split(' ')
                .map((word) => (
                  <span key={word}>{word}</span>
                ))}
            </span>
          </Link>
        </SidebarSection>
      </SidebarHeader>

      <SidebarBody>
        <SidebarSection>
          <SidebarItem href="/home" current={isItemCurrent('/home', pathname)}>
            <HomeIcon data-slot="icon" />
            <SidebarLabel>{t('home')}</SidebarLabel>
          </SidebarItem>
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
              href="/superadmin"
              current={isItemCurrent('/superadmin', pathname)}
            >
              <ShieldCheckIcon data-slot="icon" />
              <SidebarLabel>{t('superadmin')}</SidebarLabel>
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
                <span className="ml-2 inline-flex items-center rounded-md bg-amber-400 px-1.5 py-0.5 text-xs font-bold text-zinc-900">
                  {unreadNotificationCount > 99
                    ? '99+'
                    : unreadNotificationCount}
                </span>
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
          <div className="inline-block rounded-lg bg-white/15 px-1 py-px">
            <LocaleSwitcher />
          </div>
        </div>
      </SidebarBody>

      <SidebarFooter>
        <p className="px-4 py-2 text-xs text-white/40">{getVersion()}</p>
      </SidebarFooter>
    </Sidebar>
  );
}
