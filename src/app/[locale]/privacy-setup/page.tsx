import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Button } from '@/src/web/components/catalyst/button';
import { Divider } from '@/src/web/components/catalyst/divider';
import { PrivacySetupForm } from '@/web/components/privacy/PrivacySetupForm';
import { logoutAction } from '@/web/actions/auth';
import { consumeReturnToCookieServer } from '@/web/lib/returnTo.server';

export async function generateMetadata() {
  const t = await getTranslations('privacySetup');

  return { title: t('title') };
}

export default async function PrivacySetupPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  // Unconfirmed users must confirm phone first
  if (!user.isConfirmed()) {
    redirect('/confirm-phone');
  }

  // Already completed — go home
  if (user.privacySetupCompleted) {
    const returnTo = await consumeReturnToCookieServer();
    redirect(returnTo || '/home');
  }

  const t = await getTranslations('privacySetup');
  const tAccount = await getTranslations('account');

  return (
    <div className="mx-auto max-w-lg px-4 py-12">
      <div className="space-y-6">
        <div className="space-y-2 text-center">
          <Heading className="text-3xl font-bold">{t('title')}</Heading>
          <Text>{t('subtitle')}</Text>
        </div>

        <Divider />

        <div className="rounded-lg bg-white p-6 shadow ring-1 ring-zinc-950/5 dark:bg-zinc-900 dark:ring-white/10">
          <PrivacySetupForm nickname={user.nickname.getValue()} />
        </div>

        <div className="flex justify-center">
          <form action={logoutAction}>
            <Button type="submit" color="red">
              {tAccount('logout')}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
