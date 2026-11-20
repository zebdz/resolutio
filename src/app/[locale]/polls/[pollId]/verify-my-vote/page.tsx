/** Render only a poll ID. The verifier fetches filtered evidence over HTTP so
 * React Server Component diagnostics can never serialize private database reads. */
import { getTranslations } from 'next-intl/server';
import { notFound } from 'next/navigation';
import { PollId } from '@/domain/seal/SealValues';
import { Heading } from '@/web/components/catalyst/heading';
import { VoterEvidenceLoader } from '@/web/components/seal/VoterEvidenceLoader';

export default async function VerifyMyVotePage({
  params,
}: {
  params: Promise<{ locale: string; pollId: string }>;
}) {
  const { locale, pollId } = await params;
  const poll = PollId.schema.safeParse(pollId);

  if (!poll.success) {
    notFound();
  }

  const t = await getTranslations({ locale, namespace: 'sealPrivate' });

  return (
    <main className="mx-auto max-w-3xl space-y-5 px-4 py-8 sm:px-6">
      <Heading>{t('title')}</Heading>
      <VoterEvidenceLoader key={poll.data} pollId={poll.data} />
    </main>
  );
}
