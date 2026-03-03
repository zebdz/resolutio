import { getTranslations } from 'next-intl/server';
import { Link } from '@/src/i18n/routing';

export async function generateMetadata() {
  const t = await getTranslations('privacy');

  return {
    title: t('title'),
  };
}

export default async function PrivacyPolicyPage() {
  const t = await getTranslations('privacy');

  const dataItems = [
    'name',
    'phone',
    'password',
    'language',
    'ip',
    'votes',
    'membership',
  ] as const;

  const rightsItems = [
    'access',
    'rectification',
    'deletion',
    'restriction',
    'portability',
    'withdraw',
  ] as const;

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-900">
      <div className="mx-auto max-w-3xl px-6 py-12 lg:px-8">
        <Link
          href="/"
          className="mb-8 inline-block text-sm text-brand-green hover:underline"
        >
          &larr; {t('backToHome')}
        </Link>

        <h1 className="mb-2 text-3xl font-bold text-zinc-900 dark:text-white">
          {t('title')}
        </h1>
        <p className="mb-10 text-sm text-zinc-500 dark:text-zinc-400">
          {t('lastUpdated')}
        </p>

        <div className="space-y-8 text-base/7 text-zinc-700 dark:text-zinc-300">
          {/* Intro */}
          <p>{t('intro')}</p>

          {/* Data Collected */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">
              {t('dataCollected.heading')}
            </h2>
            <p className="mb-3">{t('dataCollected.description')}</p>
            <ul className="list-disc space-y-1 pl-6">
              {dataItems.map((item) => (
                <li key={item}>{t(`dataCollected.items.${item}`)}</li>
              ))}
            </ul>
          </section>

          {/* Legal Basis */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">
              {t('legalBasis.heading')}
            </h2>
            <p>{t('legalBasis.description')}</p>
          </section>

          {/* Third Parties */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">
              {t('thirdParties.heading')}
            </h2>
            <p>{t('thirdParties.description')}</p>
          </section>

          {/* Retention */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">
              {t('retention.heading')}
            </h2>
            <p>{t('retention.description')}</p>
          </section>

          {/* User Rights */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">
              {t('userRights.heading')}
            </h2>
            <p className="mb-3">{t('userRights.description')}</p>
            <ul className="list-disc space-y-1 pl-6">
              {rightsItems.map((item) => (
                <li key={item}>{t(`userRights.items.${item}`)}</li>
              ))}
            </ul>
          </section>

          {/* Contact */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">
              {t('contact.heading')}
            </h2>
            <p>{t('contact.description', { email: 'privacy@resolutio.ru' })}</p>
          </section>

          {/* Updates */}
          <section>
            <h2 className="mb-3 text-xl font-semibold text-zinc-900 dark:text-white">
              {t('updates.heading')}
            </h2>
            <p>{t('updates.description')}</p>
          </section>
        </div>
      </div>
    </div>
  );
}
