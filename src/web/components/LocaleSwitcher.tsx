'use client';

import { useLocale } from 'next-intl';
import { usePathname, Link } from '@/src/i18n/routing';

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();

  const otherLocale = locale === 'en' ? 'ru' : 'en';
  const otherLocaleLabel = otherLocale === 'en' ? 'English' : 'Russian';

  return (
    <Link
      href={pathname}
      locale={otherLocale}
      aria-label={`Switch to ${otherLocaleLabel}`}
      className="group rounded-full bg-white/90 px-3 py-2 text-sm font-medium shadow-lg shadow-zinc-800/5 ring-1 ring-zinc-900/5 backdrop-blur transition dark:bg-zinc-800/90 dark:ring-white/10 dark:hover:ring-white/20"
    >
      <span className="text-zinc-800 dark:text-zinc-200">
        {otherLocale.toUpperCase()}
      </span>
    </Link>
  );
}
