import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Badge } from '@/app/components/catalyst/badge';
import { Divider } from '@/app/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';

type Props = {
  organizationId: string;
  boards: Array<{
    id: string;
    name: string;
    memberCount: number;
    isUserMember: boolean;
  }>;
  showManageBoards: boolean;
};

export async function BoardsSection({
  organizationId,
  boards,
  showManageBoards,
}: Props) {
  const t = await getTranslations('organization.detail');

  return (
    <>
      <Divider />
      <div>
        <div className="mb-4 flex items-center justify-between">
          <Heading level={2}>{t('boards')}</Heading>
          {showManageBoards && (
            <Link href={`/organizations/${organizationId}/boards/manage`}>
              <Button color="zinc">{t('manageBoards')}</Button>
            </Link>
          )}
        </div>
        {boards.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {boards.map((board) => (
              <div
                key={board.id}
                className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <Heading level={3} className="text-lg font-semibold">
                      {board.name}
                    </Heading>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge color="zinc">
                      {t('boardMemberCount', {
                        count: board.memberCount,
                      })}
                    </Badge>
                    {board.isUserMember && (
                      <Badge color="green">{t('boardMember')}</Badge>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
            <Text className="text-lg text-zinc-500 dark:text-zinc-400">
              {t('noBoards')}
            </Text>
          </div>
        )}
      </div>
    </>
  );
}
