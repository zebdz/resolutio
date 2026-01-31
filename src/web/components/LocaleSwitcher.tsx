'use client';

import { useLocale } from 'next-intl';
import { usePathname, Link } from '@/src/i18n/routing';
import { locales } from '@/src/i18n/locales';

const localeLabels: Record<string, string> = {
  en: 'English',
  ru: 'Русский',
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  // Get next locale in the list (cycles through all available locales) eslint-disable-next-line
  const currentIndex = locales.indexOf(locale as any);
  const nextIndex = (currentIndex + 1) % locales.length;
  const otherLocale = locales[nextIndex];
  const otherLocaleLabel =
    localeLabels[otherLocale] || otherLocale.toUpperCase();

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      aria-label={`Switch to ${otherLocaleLabel}`}
      className="flex items-center gap-2 rounded-lg p-2 text-sm font-medium text-zinc-950 hover:bg-zinc-950/5 dark:text-white dark:hover:bg-white/5"
    >
      <span>{otherLocale.toUpperCase()}</span>
    </Link>
  );
}
