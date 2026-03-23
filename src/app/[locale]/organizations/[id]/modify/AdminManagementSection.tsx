import { getTranslations } from 'next-intl/server';
import { Text } from '@/src/web/components/catalyst/text';
import { Button } from '@/src/web/components/catalyst/button';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Link } from '@/src/i18n/routing';
import { AdminsListContent, OrgAdmin } from '../AdminsListContent';

type Props = {
  organizationId: string;
  initialAdmins: OrgAdmin[];
  initialAdminsTotalCount: number;
  pendingAdminInviteCount: number;
};

export async function AdminManagementSection({
  organizationId,
  initialAdmins,
  initialAdminsTotalCount,
  pendingAdminInviteCount,
}: Props) {
  const t = await getTranslations('organization.detail');

  return (
    <div>
      <Text className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {t('adminsSection')}
      </Text>

      <div className="mb-4">
        {/* Header row */}
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
              {t('adminsSection')}
            </h3>
            <Badge color="zinc">
              {t('adminCount', { count: initialAdminsTotalCount })}
            </Badge>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Link href={`/organizations/${organizationId}/manage-admins`}>
              <Button color="zinc">
                {t('manageAdmins')}
                {pendingAdminInviteCount > 0 && (
                  <Badge className="ml-2 !bg-white/90 !text-zinc-900">
                    {pendingAdminInviteCount}
                  </Badge>
                )}
              </Button>
            </Link>
          </div>
        </div>

        {/* Admins list with search/pagination */}
        <AdminsListContent
          organizationId={organizationId}
          initialAdmins={initialAdmins}
          initialTotalCount={initialAdminsTotalCount}
        />
      </div>
    </div>
  );
}
