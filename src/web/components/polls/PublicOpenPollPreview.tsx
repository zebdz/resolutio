import { getTranslations } from 'next-intl/server';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PollState } from '@/src/domain/poll/PollState';
import { SetReturnTo } from '@/web/components/shared/SetReturnTo';
import type { OpenPollPreview } from '@/application/poll/GetOpenPollPreviewUseCase';
import { MarkdownRenderer } from '@/web/components/markdown/MarkdownRenderer';
import { POLL_ATTACHMENT_API_PREFIX } from '@/domain/poll/PollAttachment';

interface PublicOpenPollPreviewProps {
  pollId: string;
  preview: OpenPollPreview;
}

/**
 * What an anonymous visitor sees when they follow a shared open-poll link:
 * enough to understand what they are being asked to vote on, and nothing more.
 */
export async function PublicOpenPollPreview({
  pollId,
  preview,
}: PublicOpenPollPreviewProps) {
  const t = await getTranslations('poll.publicPreview');

  const statusNote =
    preview.state === PollState.ACTIVE
      ? null
      : preview.state === PollState.FINISHED
        ? t('votingEnded')
        : t('votingNotStarted');

  return (
    <div className="mx-auto max-w-lg space-y-6 px-4 py-12">
      {/* Belt and braces: the middleware already recorded this path, but the
          preview keeps working even if that rule is ever narrowed. */}
      <SetReturnTo path={`/polls/${pollId}/vote`} />

      <div className="space-y-2 text-center">
        <span className="inline-flex items-center gap-1 rounded-full bg-sky-100 px-2 py-1 text-xs font-medium text-sky-700 dark:bg-sky-900/40 dark:text-sky-300">
          {t('openPollBadge')}
        </span>
        <Heading className="text-2xl font-bold">{preview.title}</Heading>
        <Text>{preview.organizationName}</Text>
      </div>

      {/* Not centred: a long description reads badly centre-aligned, and the
          description may now carry paragraphs, lists and inline images. */}
      {preview.description && (
        <MarkdownRenderer
          source={preview.description}
          apiPrefix={POLL_ATTACHMENT_API_PREFIX}
          allowedAttachmentIds={preview.attachmentIds}
        />
      )}

      {statusNote && (
        <p className="rounded-lg bg-yellow-50 p-3 text-center text-sm text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200">
          {statusNote}
        </p>
      )}

      <p className="text-center text-sm text-zinc-600 dark:text-zinc-400">
        {t('explainer')}
      </p>

      <div className="flex flex-col gap-3">
        <Link href="/login" prefetch={false}>
          <Button color="brand-green" className="w-full">
            {t('loginToVote')}
          </Button>
        </Link>
        <Link href="/register" prefetch={false}>
          <Button color="zinc" className="w-full">
            {t('registerToVote')}
          </Button>
        </Link>
      </div>
    </div>
  );
}
