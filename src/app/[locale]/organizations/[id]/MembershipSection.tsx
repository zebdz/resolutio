import { getTranslations } from 'next-intl/server';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Badge } from '@/app/components/catalyst/badge';
import { Link } from '@/src/i18n/routing';
import { JoinOrganizationButton } from './JoinOrganizationButton';

type Props = {
  organizationId: string;
  isUserMember: boolean;
  showMemberRequests: boolean;
  pendingMemberRequestCount?: number;
};

export async function MembershipSection({
  organizationId,
  isUserMember,
  showMemberRequests,
  pendingMemberRequestCount = 0,
}: Props) {
  const showJoinButton = !isUserMember;

  if (!showJoinButton && !showMemberRequests) {
    return null;
  }

  const t = await getTranslations('organization.detail');

  return (
    <div>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {t('membershipSection')}
      </Text>
      <div className="flex flex-wrap items-start gap-3">
        {showMemberRequests && (
          <Link href={`/organizations/${organizationId}/pending-requests`}>
            <Button color="amber">
              {t('memberRequests')}
              {pendingMemberRequestCount > 0 && (
                <Badge color="red" className="ml-2">
                  {pendingMemberRequestCount}
                </Badge>
              )}
            </Button>
          </Link>
        )}
        {showJoinButton && (
          <JoinOrganizationButton organizationId={organizationId} />
        )}
      </div>
    </div>
  );
}
