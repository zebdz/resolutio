import { getTranslations } from 'next-intl/server';
import { Text } from '@/app/components/catalyst/text';
import { Button } from '@/app/components/catalyst/button';
import { Badge } from '@/app/components/catalyst/badge';
import { Link } from '@/src/i18n/routing';
import { JoinOrganizationButton } from './JoinOrganizationButton';
import { MembersListContent, OrgMember } from './MembersListContent';

type Props = {
  organizationId: string;
  isUserMember: boolean;
  showMemberRequests: boolean;
  pendingMemberRequestCount?: number;
  pendingMemberInviteCount?: number;
  showMembersList?: boolean;
  initialMembers?: OrgMember[];
  initialMembersTotalCount?: number;
};

export async function MembershipSection({
  organizationId,
  isUserMember,
  showMemberRequests,
  pendingMemberRequestCount = 0,
  pendingMemberInviteCount = 0,
  showMembersList = false,
  initialMembers = [],
  initialMembersTotalCount = 0,
}: Props) {
  const showJoinButton = !isUserMember;

  if (!showJoinButton && !showMemberRequests && !showMembersList) {
    return null;
  }

  const t = await getTranslations('organization.detail');

  return (
    <div>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {t('membershipSection')}
      </Text>

      {showMembersList && (
        <div className="mb-4">
          {/* Header row */}
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                {t('members')}
              </h3>
              <Badge color="zinc">
                {t('memberCount', { count: initialMembersTotalCount })}
              </Badge>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Link href={`/organizations/${organizationId}/manage-members`}>
                <Button color="zinc">
                  {t('manageMembers')}
                  {pendingMemberInviteCount > 0 && (
                    <Badge className="ml-2 !bg-white/90 !text-zinc-900">
                      {pendingMemberInviteCount}
                    </Badge>
                  )}
                </Button>
              </Link>
              {showMemberRequests && (
                <Link
                  href={`/organizations/${organizationId}/pending-requests`}
                >
                  <Button color="zinc">
                    {t('memberRequests')}
                    {pendingMemberRequestCount > 0 && (
                      <Badge className="ml-2 !bg-white/90 !text-zinc-900">
                        {pendingMemberRequestCount}
                      </Badge>
                    )}
                  </Button>
                </Link>
              )}
            </div>
          </div>

          {/* Members list with search/pagination */}
          <MembersListContent
            organizationId={organizationId}
            initialMembers={initialMembers}
            initialTotalCount={initialMembersTotalCount}
          />
        </div>
      )}

      {/* Non-members-list buttons (join button, standalone member requests) */}
      {!showMembersList && (
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
      )}

      {showMembersList && showJoinButton && (
        <JoinOrganizationButton organizationId={organizationId} />
      )}
    </div>
  );
}
