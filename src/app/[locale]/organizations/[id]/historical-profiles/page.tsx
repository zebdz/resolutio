/** Owner and organization-admin view of supplemental historical profile information. */
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { readProfiles } from '@/infrastructure/history/history';

export default async function Profiles({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [{ id }, user, t] = await Promise.all([
    params,
    getCurrentUser(),
    getTranslations('history'),
  ]);

  if (!user) {
    notFound();
  }

  const profiles = await readProfiles(user.id, id);

  if (!profiles.length) {
    notFound();
  }

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      <h1>{t('profiles')}</h1>
      {profiles.map((p) => (
        <section key={p.user_id}>
          <h2>{p.display_name}</h2>
          {p.ownership && (
            <p>
              {t('ownership')} · {p.ownership}
            </p>
          )}
          {p.job && (
            <p>
              {t('job')} · {p.job}
            </p>
          )}
        </section>
      ))}
    </main>
  );
}
