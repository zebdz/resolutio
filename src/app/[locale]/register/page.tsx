import { redirect } from 'next/navigation';
import { AuthLayout } from '@/app/components/catalyst/auth-layout';
import { RegisterForm } from '@/web/components/auth/RegisterForm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Locale } from '@/src/i18n/locales';

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
  // Redirect to home if already logged in
  const user = await getCurrentUser();

  if (user) {
    redirect('/home');
  }

  const { locale } = await params;

  return (
    <AuthLayout>
      <RegisterForm locale={locale as Locale} />
    </AuthLayout>
  );
}
