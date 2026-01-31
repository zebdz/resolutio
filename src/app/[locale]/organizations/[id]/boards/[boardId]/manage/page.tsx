import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { getBoardDetailsAction } from '@/web/actions/board';
import { Heading, Subheading } from '@/app/components/catalyst/heading';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import AddMemberSection from './AddMemberSection';
import AddOutsideMemberSection from './AddOutsideMemberSection';
import MembersList from './MembersList';
import { AuthenticatedLayout } from '@/web/components/AuthenticatedLayout';

type PageProps = {
  params: Promise<{
    locale: string;
    id: string;
    boardId: string;
  }>;
};

export default async function ManageSingleBoardPage({ params }: PageProps) {
  const { id: organizationId, boardId } = await params;
  const t = await getTranslations('organization.boards.manageSingle');
  const tCommon = await getTranslations('common');

  // Get board details
  const result = await getBoardDetailsAction(boardId);

  if (!result.success) {
    notFound();
  }

  const { board, members, organizationMembers } = result.data;

  // Filter out users who are already members
  const availableUsers = organizationMembers.filter(
    (om) => !members.some((m) => m.id === om.id)
  );

  return (
    <AuthenticatedLayout>
      <div className="mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <Heading>{t('title')}</Heading>
            <Subheading className="mt-2">
              {t('subtitle', { board: board.name })}
            </Subheading>
          </div>
          <div className="flex gap-2">
            <Link href={`/organizations/${organizationId}/boards/manage`}>
              <Button color="zinc">{tCommon('back')}</Button>
            </Link>
          </div>
        </div>

        {/* Add Member Section */}
        <div className="mb-8">
          <AddMemberSection boardId={boardId} availableUsers={availableUsers} />
        </div>

        {/* Add Outside Member Section (only for non-general boards) */}
        {!board.isGeneral && (
          <div className="mb-8">
            <AddOutsideMemberSection
              boardId={boardId}
              isGeneral={board.isGeneral}
            />
          </div>
        )}

        {/* Members List */}
        <div>
          <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            {t('members')}
          </h3>
          <MembersList boardId={boardId} members={members} />
        </div>
      </div>
    </AuthenticatedLayout>
  );
}
