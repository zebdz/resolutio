import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { logoutAction } from '@/web/actions/auth';

export async function generateMetadata() {
  const t = await getTranslations('blocked');

  return { title: t('title') };
}

export default async function BlockedPage() {
  const t = await getTranslations('blocked');

  return (
    <div className="flex min-h-screen items-center justify-center bg-white px-4 dark:bg-zinc-900">
      <div className="w-full max-w-md space-y-6 text-center">
        <Heading className="text-2xl font-bold">{t('title')}</Heading>
        <Text className="text-zinc-600 dark:text-zinc-400">
          {t('message', { email: t('contactEmail') })}
        </Text>
        <form action={logoutAction}>
          <Button type="submit" className="w-full">
            {t('logout')}
          </Button>
        </form>
      </div>
    </div>
  );
}
