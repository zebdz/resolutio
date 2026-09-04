import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import { Toaster } from 'sonner';
import { ToastClickDismiss } from '@/src/web/components/layout/ToastClickDismiss';
import { routing } from '@/src/i18n/routing';
import { buildSiteMetadata } from '@/web/metadata/siteMetadata';
import '../globals.css';

// Built per request rather than declared as a static `export const metadata`,
// which cannot read the [locale] segment and so served English link previews
// on Russian URLs.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'app' });

  return buildSiteMetadata({ locale, t });
}

// Generate static params for [locale] dynamic segment
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Providing all messages to the client
  // side is the easiest way to get started
  const messages = await getMessages({ locale });

  return (
    <html lang={locale}>
      {/* --font-nunito is defined on :root in globals.css alongside the
          vendored @font-face rules; no next/font class to apply here. */}
      <body className="antialiased">
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster />
          <ToastClickDismiss />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
