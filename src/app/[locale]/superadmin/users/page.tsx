import { getTranslations } from 'next-intl/server';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { Link } from '@/src/i18n/routing';
import { UserManagementPanel } from './UserManagementPanel';
import {
  listUsersForAdminAction,
  getOrganizationNameAction,
} from '@/web/actions/suspiciousActivity';

const PAGE_SIZE = 10;

interface UsersPageProps {
  searchParams: Promise<{
    page?: string;
    search?: string;
    dateFrom?: string;
    dateTo?: string;
    allowName?: string;
    allowPhone?: string;
    blockStatus?: string;
    orgId?: string;
  }>;
}

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const t = await getTranslations('superadmin.users');
  const tHub = await getTranslations('superadmin.hub');
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const result = await listUsersForAdminAction({
    page,
    pageSize: PAGE_SIZE,
    search: params.search || undefined,
    dateFrom: params.dateFrom || undefined,
    dateTo: params.dateTo || undefined,
    allowFindByName:
      params.allowName === 'yes' || params.allowName === 'no'
        ? params.allowName
        : undefined,
    allowFindByPhone:
      params.allowPhone === 'yes' || params.allowPhone === 'no'
        ? params.allowPhone
        : undefined,
    blockStatus:
      params.blockStatus === 'blocked' || params.blockStatus === 'unblocked'
        ? params.blockStatus
        : undefined,
    organizationId: params.orgId || undefined,
  });

  // Resolve org name for combobox display if orgId is set
  let selectedOrg: { id: string; name: string } | null = null;

  if (params.orgId) {
    const orgResult = await getOrganizationNameAction({
      organizationId: params.orgId,
    });

    if (orgResult.success && orgResult.data) {
      selectedOrg = orgResult.data;
    }
  }

  const data = result.success
    ? result.data
    : { users: [], totalCount: 0, totalPages: 0 };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Link
          href="/superadmin"
          prefetch={false}
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; {tHub('back')}
        </Link>
        <Heading level={2} className="text-xl font-semibold">
          {t('title')}
        </Heading>
        <Text className="text-zinc-600 dark:text-zinc-400">
          {t('subtitle')}
        </Text>
      </div>

      <UserManagementPanel
        users={data.users}
        totalCount={data.totalCount}
        totalPages={data.totalPages}
        currentPage={page}
        filters={{
          search: params.search ?? '',
          dateFrom: params.dateFrom ?? '',
          dateTo: params.dateTo ?? '',
          allowName: params.allowName ?? '',
          allowPhone: params.allowPhone ?? '',
          blockStatus: params.blockStatus ?? '',
          orgId: params.orgId ?? '',
        }}
        selectedOrg={selectedOrg}
      />
    </div>
  );
}
