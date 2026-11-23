/** Serve public poll commitments and independent verification instructions without rendering any private record.
 * The optional viewer capability is fetched in the browser. This render never reads session or worker data. */
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PollId } from '@/domain/seal/SealValues';
import { readManifest } from '@/domain/seal/RecordValidation';
import { prisma } from '@/infrastructure/database/prisma';
import { readPublicSeal } from '@/infrastructure/repositories/PrismaSealSummaries';
import { SealStatusBadge } from '@/web/components/seal/SealStatusBadge';
import { CopyDigest } from '@/web/components/seal/CopyDigest';
import { PublicSealActions } from '@/web/components/seal/PublicSealActions';
import { VerificationLayout } from '@/web/components/seal/VerificationLayout';
import { Heading, Subheading } from '@/web/components/catalyst/heading';
export const dynamic = 'force-dynamic';

const linkStyle =
  'cursor-pointer text-blue-700 underline underline-offset-2 dark:text-blue-400';

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ pollId: string; locale: string }>;
}) {
  const { pollId, locale } = await params;
  const id = PollId.schema.safeParse(pollId);

  if (!id.success) {
    notFound();
  }

  const [published, t] = await Promise.all([
    readPublicSeal(prisma.pollSeal, id.data),
    getTranslations({ locale, namespace: 'sealPublic' }),
  ]);

  if (!published.success) {
    const missing = published.error === 'seal.errors.notFound';

    return (
      <VerificationLayout>
        <Heading>{t('title')}</Heading>
        <p role={missing ? 'status' : 'alert'}>
          {t(missing ? 'missing' : 'loadError')}
        </p>
        {missing && (
          <PublicSealActions
            key={pollId}
            pollId={pollId}
            locale={locale}
            record={null}
            recover
          />
        )}
      </VerificationLayout>
    );
  }

  const { manifest, rootDigest, proofAvailable, status } = published.value;

  const sections = readManifest(manifest).sections;

  return (
    <VerificationLayout>
      <header className="space-y-2">
        <Heading>{t('title')}</Heading>
        <SealStatusBadge status={status} />
        {status.kind === 'bitcoin' && (
          <p className="flex flex-wrap gap-x-3">
            <time dateTime={status.time}>
              {new Intl.DateTimeFormat(locale, {
                dateStyle: 'long',
                timeStyle: 'long',
                timeZone: 'UTC',
              }).format(new Date(status.time))}
            </time>
            <a
              className={linkStyle}
              href={'https://blockchair.com/bitcoin/block/' + status.height}
            >
              {t('explorer', { height: status.height })}
            </a>
          </p>
        )}
      </header>
      <section className="space-y-2">
        <Subheading>{t('root')}</Subheading>
        <CopyDigest digest={rootDigest} />
      </section>
      <section className="space-y-2">
        <Subheading>{t('sectionsTitle')}</Subheading>
        <dl className="divide-y divide-zinc-200 dark:divide-zinc-700">
          {(['poll', 'tallies', 'register', 'votes', 'signers'] as const).map(
            (key) => (
              <div key={key} className="py-2">
                <dt className="text-sm font-medium">{t(key)}</dt>
                <dd>
                  <CopyDigest
                    digest={
                      key === 'votes' ? sections.votes.root : sections[key].hash
                    }
                  />
                </dd>
              </div>
            )
          )}
        </dl>
      </section>
      <PublicSealActions
        key={pollId}
        pollId={pollId}
        locale={locale}
        recover={status.kind !== 'bitcoin'}
        record={{ manifest, rootDigest, proofAvailable }}
      />
    </VerificationLayout>
  );
}
