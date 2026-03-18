import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import { Nunito } from 'next/font/google';
import { Toaster } from 'sonner';
import { ToastClickDismiss } from '@/web/components/ToastClickDismiss';
import { routing } from '@/src/i18n/routing';
import '../globals.css';

const nunito = Nunito({
  variable: '--font-nunito',
  subsets: ['latin', 'cyrillic'],
});

export const metadata: Metadata = {
  title: 'НОМОС',
  description: 'Unite in organizations, vote, and create legal decisions',
};

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
      <body className={`${nunito.variable} antialiased`}>
        <NextIntlClientProvider messages={messages}>
          {children}
          <Toaster />
          <ToastClickDismiss />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
