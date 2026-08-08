import { getTranslations } from 'next-intl/server';
import { redirect } from 'next/navigation';
import {
  getUserVotingProgressAction,
  canUserVoteAction,
} from '@/src/web/actions/poll/vote';
import { getCurrentUser } from '@/web/lib/session';
import {
  prisma,
  PrismaPollRepository,
  PrismaOrganizationRepository,
} from '@/infrastructure/index';
import { GetOpenPollPreviewUseCase } from '@/application/poll/GetOpenPollPreviewUseCase';
import { PublicOpenPollPreview } from '@/src/web/components/polls/PublicOpenPollPreview';
import VotingInterface from '@/src/web/components/polls/voting/VotingInterface';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Link } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import { ArrowLeftIcon } from '@heroicons/react/20/solid';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { MarkdownRenderer } from '@/web/components/markdown/MarkdownRenderer';
import { POLL_ATTACHMENT_API_PREFIX } from '@/domain/poll/PollAttachment';

interface VotePageProps {
  params: Promise<{
    pollId: string;
    locale: string;
  }>;
}

export default async function VotePage({ params }: VotePageProps) {
  const { pollId } = await params;
  const commonT = await getTranslations('common');
  const votingT = await getTranslations('poll.voting');

  // Anonymous visitor following a shared link: an open poll shows a public
  // headline so the link explains itself, while every other poll — regular,
  // archived or nonexistent — is answered identically with the login screen.
  const currentUser = await getCurrentUser();

  if (!currentUser) {
    const previewUseCase = new GetOpenPollPreviewUseCase(
      new PrismaPollRepository(prisma),
      new PrismaOrganizationRepository(prisma)
    );
    const previewResult = await previewUseCase.execute({ pollId });
    const preview = previewResult.success ? previewResult.value : null;

    if (!preview) {
      redirect('/login');
    }

    return <PublicOpenPollPreview pollId={pollId} preview={preview} />;
  }

  // Check if user can vote
  const canVoteResult = await canUserVoteAction(pollId);

  if (!canVoteResult.success) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            {canVoteResult.error}
          </p>
        </div>
        <div className="mt-4">
          <Link href="/polls">
            <Button color="zinc" className="inline-flex items-center">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {commonT('back')}
            </Button>
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  if (!canVoteResult.data.canVote) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
          <p className="text-sm text-yellow-800 dark:text-yellow-200">
            {votingT(canVoteResult.data.reasonCode as any)}
          </p>
        </div>
        <div className="mt-4">
          <Link href="/polls">
            <Button color="zinc" className="inline-flex items-center">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {commonT('back')}
            </Button>
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  // Get voting progress
  const progressResult = await getUserVotingProgressAction(pollId);

  if (!progressResult.success) {
    return (
      <AuthenticatedLayout>
        <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/20">
          <p className="text-sm text-red-800 dark:text-red-200">
            {progressResult.error}
          </p>
        </div>
        <div className="mt-4">
          <Link href="/polls">
            <Button color="zinc" className="inline-flex items-center">
              <ArrowLeftIcon className="w-4 h-4 mr-2" />
              {commonT('back')}
            </Button>
          </Link>
        </div>
      </AuthenticatedLayout>
    );
  }

  const { poll, drafts } = progressResult.data;

  // Serialize poll data to plain objects for client component
  const serializedPoll = {
    id: poll.id,
    title: poll.title,
    description: poll.description,
    // Ids only — the renderer needs them to refuse refs to other polls'
    // files. Attachment bytes never cross to the client.
    attachmentIds: poll.attachmentIds ?? [],
    pollType: poll.pollType,
    anonymous: !!poll.anonymous,
    // The notice has to warn about the property listing too, and only an
    // ownership-weighted poll puts holdings in the named protocol.
    isPropertyBased:
      poll.distributionType === 'OWNERSHIP_UNIT_COUNT' ||
      poll.distributionType === 'OWNERSHIP_SIZE_WEIGHTED',
    questions: poll.questions.map((q: any) => ({
      id: q.id,
      text: q.text,
      details: q.details,
      page: q.page,
      order: q.order,
      questionType: q.questionType,
      answers: q.answers.map((a: any) => ({
        id: a.id,
        text: a.text,
        order: a.order,
      })),
    })),
  };

  const serializedDrafts = drafts.map((d: any) => ({
    id: d.id,
    questionId: d.questionId,
    answerId: d.answerId,
  }));

  return (
    <AuthenticatedLayout>
      <div className="mb-6">
        <Heading>{serializedPoll.title}</Heading>
        {serializedPoll.description && (
          <div className="mt-2 text-zinc-600 dark:text-zinc-400">
            <MarkdownRenderer
              source={serializedPoll.description}
              apiPrefix={POLL_ATTACHMENT_API_PREFIX}
              allowedAttachmentIds={serializedPoll.attachmentIds}
            />
          </div>
        )}
      </div>

      {serializedPoll.pollType === 'OPEN' && (
        <div className="mb-6 rounded-lg bg-sky-50 p-4 dark:bg-sky-900/20">
          <p className="text-sm text-sky-900 dark:text-sky-200">
            {votingT('openPollBanner')}
          </p>
        </div>
      )}

      <VotingInterface
        poll={serializedPoll}
        userDrafts={serializedDrafts}
        pollId={pollId}
        isAnonymous={serializedPoll.anonymous}
        isPropertyBased={serializedPoll.isPropertyBased}
      />
    </AuthenticatedLayout>
  );
}
