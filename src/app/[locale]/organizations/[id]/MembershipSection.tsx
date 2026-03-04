import { getTranslations } from 'next-intl/server';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { JoinOrganizationButton } from './JoinOrganizationButton';

type Props = {
  organizationId: string;
  isUserMember: boolean;
  isUserAdmin: boolean;
};

export async function MembershipSection({
  organizationId,
  isUserMember,
  isUserAdmin,
}: Props) {
  const showJoinButton = !isUserMember;
  const showMemberRequests = isUserAdmin;

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
            <Button color="amber">{t('memberRequests')}</Button>
          </Link>
        )}
        {showJoinButton && (
          <JoinOrganizationButton organizationId={organizationId} />
        )}
      </div>
    </div>
  );
}
