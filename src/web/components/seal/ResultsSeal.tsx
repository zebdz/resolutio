/** Results viewers can open their permitted sections and voters can inspect their own ballot. */
import { getTranslations } from 'next-intl/server';
import { Link } from '@/src/i18n/routing';
import { prisma } from '@/infrastructure/database/prisma';
import { readSealSummaries } from '@/infrastructure/repositories/PrismaSealSummaries';
import type { PollId, UserId } from '@/domain/shared/EntityIds';
import { SealStatusBadge } from './SealStatusBadge';
import { CopyDigest } from './CopyDigest';

export async function ResultsSeal({
  pollId,
  userId,
  finishedAt,
}: {
  pollId: PollId;
  userId: UserId;
  finishedAt: Date | null;
}) {
  const [t, summaries, vote] = await Promise.all([
    getTranslations('sealStatus'),
    readSealSummaries(prisma.pollSeal, [pollId]),
    prisma.vote.findFirst({
      where: { userId, question: { pollId } },
      select: { id: true },
    }),
  ]);
  const link = 'cursor-pointer text-sky-700 underline dark:text-sky-300';

  if (!summaries.success) {
    return <p role="alert">{t('unavailable')}</p>;
  }

  const seal = summaries.value.get(pollId);

  return (
    <section
      aria-label={t('record')}
      className="mb-6 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
    >
      <SealStatusBadge
        status={seal?.status ?? { kind: finishedAt ? 'sealing' : 'unsealed' }}
      />
      {seal && <CopyDigest digest={seal.rootDigest} />}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link className={link} href={`/verify/${pollId}`}>
          {t('record')}
        </Link>
        {seal && (
          <a
            className={link}
            href={`/api/polls/${pollId}/seal/sections`}
            download
          >
            {t('download')}
          </a>
        )}
        {seal && vote && (
          <Link className={link} href={`/polls/${pollId}/verify-my-vote`}>
            {t('myVote')}
          </Link>
        )}
      </div>
    </section>
  );
}
