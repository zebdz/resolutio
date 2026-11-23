'use client';

/** Public pages link to the localized homepage and sign-in without requiring a session. */
import { useTranslations } from 'next-intl';
import { Link } from '@/src/i18n/routing';
import { Navbar, NavbarItem, NavbarSpacer } from '../catalyst/navbar';
import { LocaleSwitcher } from './LocaleSwitcher';

export function GuestNavbar() {
  const t = useTranslations();

  return (
    <Navbar>
      <Link href="/" aria-label={t('navbar.home')} className="cursor-pointer">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/images/logo-icon.svg" alt="" className="h-10 w-auto" />
      </Link>
      <NavbarSpacer />
      <NavbarItem href="/login">{t('landing.signIn')}</NavbarItem>
      <div className="rounded-lg bg-white/15 px-1 py-px">
        <LocaleSwitcher />
      </div>
    </Navbar>
  );
}
