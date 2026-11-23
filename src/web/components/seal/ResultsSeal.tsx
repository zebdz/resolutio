'use client';

/** The badge and downloads follow the same source as the displayed results. */
import { useTranslations } from 'next-intl';
import { Link } from '@/src/i18n/routing';
import type { PollId } from '@/domain/shared/EntityIds';
import type { ResultsCoverage } from '@/web/components/polls/results/ResultsPageView';
import { SealStatusBadge } from './SealStatusBadge';
import { CopyDigest } from './CopyDigest';

export function ResultsSeal({
  pollId,
  coverage,
}: {
  pollId: PollId;
  coverage: ResultsCoverage;
}) {
  const t = useTranslations('sealStatus');

  if (coverage.kind === 'preliminary') {
    return null;
  }

  const link = 'cursor-pointer text-sky-700 underline dark:text-sky-300';
  const status =
    coverage.kind === 'sealed' ? coverage.seal.status : { kind: coverage.kind };

  return (
    <section
      aria-label={t('record')}
      className="mb-6 space-y-3 rounded-lg border border-zinc-200 p-4 dark:border-zinc-700"
    >
      <SealStatusBadge status={status} />
      {coverage.kind === 'sealed' && (
        <CopyDigest digest={coverage.seal.rootDigest} />
      )}
      <div className="flex flex-wrap gap-4 text-sm">
        <Link className={link} href={`/verify/${pollId}`}>
          {t('record')}
        </Link>
        {coverage.kind === 'sealed' && (
          <a
            className={link}
            href={`/api/polls/${pollId}/seal/sections`}
            download
          >
            {t('download')}
          </a>
        )}
        {coverage.kind === 'sealed' && coverage.hasOwnVote && (
          <Link className={link} href={`/polls/${pollId}/verify-my-vote`}>
            {t('myVote')}
          </Link>
        )}
      </div>
    </section>
  );
}
