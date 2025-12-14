import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Badge } from '@/app/components/catalyst/badge';
import { Divider } from '@/app/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import { getOrganizationDetailsAction } from '@/web/actions/organization';
import { JoinOrganizationButton } from './JoinOrganizationButton';
import { UsersIcon } from '@heroicons/react/16/solid';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations('organization.detail');
  const tCommon = await getTranslations('common');
  const tAccount = await getTranslations('account');
  const tBoards = await getTranslations('organization.boards');

  const user = await getCurrentUser();

  // Fetch organization details
  const result = await getOrganizationDetailsAction(id);

  if (!result.success) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
          <Text className="text-red-800 dark:text-red-200">{result.error}</Text>
          <Link href="/organizations" className="mt-4 inline-block">
            <Button color="zinc">{tCommon('back')}</Button>
          </Link>
        </div>
      </main>
    );
  }

  const { organization, boards, isUserMember, isUserAdmin, firstAdmin } =
    result.data;

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="space-y-2 flex-1">
            <Heading className="text-3xl font-bold">
              {organization.name}
            </Heading>
            {firstAdmin && (
              <Text className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('firstAdmin')}: {firstAdmin.firstName} {firstAdmin.lastName}
              </Text>
            )}
          </div>
          <div className="flex gap-2">
            <Link href="/organizations">
              <Button color="zinc">{tCommon('back')}</Button>
            </Link>
            {user && (
              <Link href="/account">
                <Button color="zinc">{tAccount('button')}</Button>
              </Link>
            )}
          </div>
        </div>

        {/* Description */}
        <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <Heading level={2} className="mb-4">
            {t('description')}
          </Heading>
          <Text className="text-zinc-700 dark:text-zinc-300">
            {organization.description}
          </Text>
        </div>

        {/* Action Buttons for Logged-in Users */}
        {user && !isUserMember && (
          <JoinOrganizationButton organizationId={id} />
        )}

        {isUserAdmin && (
          <div className="flex gap-4 flex-wrap">
            <Link href={`/organizations/${id}/pending-requests`}>
              <Button color="amber">{t('pendingRequests')}</Button>
            </Link>
            <Link href={`/organizations/${id}/boards/manage`}>
              <Button color="blue">{t('manageBoards')}</Button>
            </Link>
          </div>
        )}

        {/* Boards Section - Only visible to members */}
        {(isUserMember || isUserAdmin) && boards.length > 0 && (
          <>
            <Divider />
            <div>
              <Heading level={2} className="mb-4">
                {t('boards')}
              </Heading>
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
                        {board.isGeneral && (
                          <Badge color="blue" className="shrink-0">
                            <UsersIcon className="h-5 w-5 sm:h-4 sm:w-4" />
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge color="zinc">
                          {t('boardMemberCount', { count: board.memberCount })}
                        </Badge>
                        {board.isUserMember && (
                          <Badge color="green">{t('boardMember')}</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* No Boards Message */}
        {isUserMember && boards.length === 0 && (
          <>
            <Divider />
            <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
              <Text className="text-lg text-zinc-500 dark:text-zinc-400">
                {t('noBoards')}
              </Text>
            </div>
          </>
        )}

        {/* Recent Polls Section - Only visible to members */}
        {isUserMember && (
          <>
            <Divider />
            <div>
              <Heading level={2} className="mb-4">
                {t('recentPolls')}
              </Heading>
              <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
                <Text className="text-lg text-zinc-500 dark:text-zinc-400">
                  {t('noPolls')}
                </Text>
                <Text className="mt-2 text-sm text-zinc-400 dark:text-zinc-500">
                  Polls functionality coming soon...
                </Text>
              </div>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
