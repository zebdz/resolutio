import { notFound, redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import CreateBoardDialog from './CreateBoardDialog';
import ArchiveBoardButton from './ArchiveBoardButton';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
  }>;
};

export default async function ManageBoardsPage({ params }: PageProps) {
  const { id: organizationId, locale } = await params;
  const t = await getTranslations('organization.boards.manage');
  const tCommon = await getTranslations('common');

  // Get organization details
  const detailsResult = await getOrganizationDetailsAction(organizationId);

  if (!detailsResult.success) {
    notFound();
  }

  // Only admins can manage boards
  if (!detailsResult.data.isUserAdmin) {
    redirect(`/${locale}/organizations/${organizationId}`);
  }

  const { organization, boards } = detailsResult.data;

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Heading>{t('title')}</Heading>
            <Subheading className="mt-2">
              {t('subtitle', { organization: organization.name })}
            </Subheading>
          </div>
          <div className="flex gap-2">
            <Link href={`/organizations/${organizationId}`}>
              <Button color="zinc">{tCommon('back')}</Button>
            </Link>
            <CreateBoardDialog organizationId={organizationId} />
          </div>
        </div>

        {/* Boards */}
        {boards.length > 0 ? (
          <div className="space-y-4">
            {boards.map((board) => (
              <div
                key={board.id}
                className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                      {board.name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                      {t('memberCount', { count: board.memberCount })}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link
                      href={`/organizations/${organizationId}/boards/${board.id}/manage`}
                    >
                      <Button color="zinc">{t('manageBoard')}</Button>
                    </Link>
                    <ArchiveBoardButton
                      boardId={board.id}
                      boardName={board.name}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center text-zinc-500 dark:text-zinc-400">
            {t('noBoards')}
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
