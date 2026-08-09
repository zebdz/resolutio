import { AuthLayout } from '@/src/web/components/catalyst/auth-layout';
import { RegisterForm } from '@/web/components/auth/RegisterForm';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { readReturnToCookieServer } from '@/web/lib/returnTo.server';
import { Locale } from '@/src/i18n/locales';
import { redirectLocalized } from '@/web/lib/redirectLocalized';

export async function generateMetadata() {
  const t = await getTranslations('auth.register');

  return {
    title: t('title'),
  };
}

type Props = {
  params: Promise<{ locale: string }>;
};

export default async function RegisterPage({ params }: Props) {
  // Already logged in — resume the deep link if there is one
  const user = await getCurrentUser();

  if (user) {
    const returnTo = await readReturnToCookieServer();
    redirectLocalized(await getLocale(), returnTo || '/home');
  }

  const { locale } = await params;

  return (
    <AuthLayout>
      <RegisterForm locale={locale as Locale} />
    </AuthLayout>
  );
}
