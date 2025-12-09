import { redirect } from 'next/navigation';
import { AuthLayout } from '@/app/components/catalyst/auth-layout';
import { RegisterForm } from '@/web/components/auth/RegisterForm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';

export async function generateMetadata() {
  const t = await getTranslations('auth.register');

  return {
    title: t('title'),
  };
}

export default async function RegisterPage() {
  // Redirect to home if already logged in
  const user = await getCurrentUser();
  if (user) {
    redirect('/home');
  }

  return (
    <AuthLayout>
      <RegisterForm />
    </AuthLayout>
  );
}
