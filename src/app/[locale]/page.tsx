import { getTranslations } from 'next-intl/server';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { LocaleSwitcher } from '@/web/components/LocaleSwitcher';

export async function generateMetadata() {
  const t = await getTranslations('landing');

  return {
    title: t('title'),
  };
}

export default async function HomePage() {
  const t = await getTranslations('landing');

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-linear-to-b from-zinc-50 to-zinc-100 dark:from-zinc-900 dark:to-zinc-950">
      <div className="absolute top-6 right-6">
        <LocaleSwitcher />
      </div>

      <div className="max-w-3xl mx-auto text-center space-y-8">
        <div className="space-y-4">
          <Heading className="text-4xl sm:text-5xl md:text-6xl font-bold">
            {t('title')}
          </Heading>
          <Text className="text-xl text-zinc-600 dark:text-zinc-400">
            {t('subtitle')}
          </Text>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Button color="blue" className="min-w-[200px]" href="/register">
            {t('cta')}
          </Button>
          <Button outline className="min-w-[200px]" href="/login">
            {t('signIn')}
          </Button>
        </div>

        <div className="pt-8 border-t border-zinc-200 dark:border-zinc-800">
          <Text className="text-sm text-zinc-500 dark:text-zinc-500">
            ⚠️ {t('disclaimer')}
          </Text>
        </div>
      </div>
    </main>
  );
}
