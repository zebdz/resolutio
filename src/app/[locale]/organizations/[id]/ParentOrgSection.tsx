import { getTranslations } from 'next-intl/server';
import { Text } from '@/src/web/components/catalyst/text';
import { Button } from '@/src/web/components/catalyst/button';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Link } from '@/src/i18n/routing';
import { CancelJoinParentButton } from './CancelJoinParentButton';

type Props = {
  organizationId: string;
  pendingParentRequest: {
    id: string;
    parentOrgId: string;
    parentOrgName: string;
    message: string;
    createdAt: Date;
  } | null;
  incomingParentRequestCount: number;
};

export async function ParentOrgSection({
  organizationId,
  pendingParentRequest,
  incomingParentRequestCount,
}: Props) {
  const t = await getTranslations('organization.detail');
  const tJoinParent = await getTranslations('organization.joinParent');

  return (
    <div className="space-y-6">
      <div>
        <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
          {t('parentOrgSection')}
        </Text>
        <div className="flex flex-wrap items-start gap-3">
          <Link href={`/organizations/${organizationId}/join-parent-requests`}>
            <Button color="amber">
              {tJoinParent('parentOrgRequests')}
              {incomingParentRequestCount > 0 && (
                <Badge color="red" className="ml-2">
                  {incomingParentRequestCount}
                </Badge>
              )}
            </Button>
          </Link>
          {pendingParentRequest ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950">
              <Text className="font-medium text-amber-800 dark:text-amber-200">
                {tJoinParent('pendingRequestDescription', {
                  parentName: pendingParentRequest.parentOrgName,
                })}
              </Text>
              <Text className="mt-1 text-sm text-amber-700 dark:text-amber-300">
                {tJoinParent('requestMessage')}: {pendingParentRequest.message}
              </Text>
              <div className="mt-3">
                <CancelJoinParentButton requestId={pendingParentRequest.id} />
              </div>
            </div>
          ) : (
            <Link href={`/organizations/${organizationId}/join-parent`}>
              <Button color="brand-green">
                {tJoinParent('joinParentOrg')}
              </Button>
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
