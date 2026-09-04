import type { Metadata } from 'next';

import { AuthLayout } from '@/src/web/components/catalyst/auth-layout';
import { ForgotPasswordForm } from '@/web/components/auth/ForgotPasswordForm';
import { getLocale, getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { redirectLocalized } from '@/web/lib/redirectLocalized';

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.forgotPassword' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function ForgotPasswordPage() {
  // Someone already signed in has no use for this page — they can change
  // their password from the account page instead.
  const user = await getCurrentUser();

  if (user) {
    redirectLocalized(await getLocale(), '/account');
  }

  return (
    <AuthLayout>
      <ForgotPasswordForm />
    </AuthLayout>
  );
}
