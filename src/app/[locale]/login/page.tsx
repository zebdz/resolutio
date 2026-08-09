import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { AuthLayout } from '@/src/web/components/catalyst/auth-layout';
import { LoginForm } from '@/web/components/auth/LoginForm';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { readReturnToCookieServer } from '@/web/lib/returnTo.server';

// Protected pages redirect unauthenticated crawlers here, so this is the page
// link previews actually render. It carries its own description so the preview
// says what the page is, instead of inheriting the site-wide blurb.
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'auth.login' });

  return {
    title: t('title'),
    description: t('subtitle'),
  };
}

export default async function LoginPage() {
  // Redirect to home if already logged in
  const user = await getCurrentUser();

  if (user) {
    const returnTo = await readReturnToCookieServer();
    redirect(returnTo || '/home');
  }

  return (
    <AuthLayout>
      <LoginForm />
    </AuthLayout>
  );
}
