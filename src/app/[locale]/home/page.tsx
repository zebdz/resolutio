import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';

export default async function HomePage() {
  const t = await getTranslations('home');
  const tAccount = await getTranslations('account');
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Heading className="text-3xl font-bold">{t('title')}</Heading>
            <Text className="text-zinc-600 dark:text-zinc-400">
              {t('myOrganizations')}
            </Text>
          </div>
          <Link href="/account">
            <Button color="zinc">{tAccount('button')}</Button>
          </Link>
        </div>

        {/* Organizations List Placeholder */}
        <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
          <Text className="text-lg text-zinc-500 dark:text-zinc-400">
            {t('noOrganizations')}
          </Text>
          <Text className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
            Organization features coming soon...
          </Text>
        </div>
      </div>
    </main>
  );
}
