import { redirect } from 'next/navigation';
import { AuthLayout } from '@/src/web/components/catalyst/auth-layout';
import { LoginForm } from '@/web/components/auth/LoginForm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { consumeReturnToCookieServer } from '@/web/lib/returnTo.server';

export async function generateMetadata() {
  const t = await getTranslations('auth.login');

  return {
    title: t('title'),
  };
}

export default async function LoginPage() {
  // Redirect to home if already logged in
  const user = await getCurrentUser();

  if (user) {
    const returnTo = await consumeReturnToCookieServer();
    redirect(returnTo || '/home');
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
