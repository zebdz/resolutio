import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '@/web/lib/session';
import { Heading, Subheading } from '@/src/web/components/catalyst/heading';
import { Button } from '@/src/web/components/catalyst/button';
import { Link } from '@/src/i18n/routing';
import { PlusIcon } from '@heroicons/react/20/solid';
import { searchPollsAction } from '@/src/web/actions/poll/poll';
import { getBoardsByOrganizationAction } from '@/src/web/actions/board/board';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { AuthenticatedLayout } from '@/src/web/components/layout/AuthenticatedLayout';
import { PollsListUrl } from '@/src/web/components/polls/PollsListUrl';
import { PollState } from '@/domain/poll/PollState';

const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [5, 10, 25, 50];
const ORG_WIDE_VALUE = '__org_wide__';

const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

interface PollsPageProps {
  searchParams: Promise<{
    page?: string;
    pageSize?: string;
    search?: string;
    status?: string;
    orgId?: string;
    boardId?: string;
    createdFrom?: string;
    createdTo?: string;
    startFrom?: string;
    startTo?: string;
  }>;
}

export default async function PollsPage({ searchParams }: PollsPageProps) {
  const t = await getTranslations('poll');
  const user = await getCurrentUser();

  if (!user) {
    return <AuthenticatedLayout>{null}</AuthenticatedLayout>;
  }

  const sp = await searchParams;

  const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

  // Admin org IDs for canManage
  const adminOrgs = await organizationRepository.findAdminOrganizationsByUserId(
    user.id
  );
  const adminOrgIds = adminOrgs.map((o) => o.id);

  // Check org membership (lightweight — just count, don't load all orgs)
  const memberOrgs = await organizationRepository.findMembershipsByUserId(
    user.id
  );
  const hasOrgMembership = isSuperAdmin || memberOrgs.length > 0;

  // Parse filters from URL params
  const search = sp.search ?? '';
  const status = sp.status ?? '';
  const orgId = sp.orgId ?? '';
  const boardId = sp.boardId ?? '';
  const createdTo = sp.createdTo ?? '';
  const startFrom = sp.startFrom ?? '';
  const startTo = sp.startTo ?? '';

  const rawPage = parseInt(sp.page ?? '1', 10);
  const page = rawPage > 0 ? rawPage : 1;

  const rawPageSize = parseInt(sp.pageSize ?? String(DEFAULT_PAGE_SIZE), 10);
  const pageSize = PAGE_SIZE_OPTIONS.includes(rawPageSize)
    ? rawPageSize
    : DEFAULT_PAGE_SIZE;

  // Default createdFrom to one week ago when no filters at all
  const hasAnyFilter =
    search ||
    status ||
    orgId ||
    boardId ||
    sp.createdFrom ||
    createdTo ||
    startFrom ||
    startTo;

  let createdFrom: string;

  if (sp.createdFrom !== undefined) {
    createdFrom = sp.createdFrom;
  } else if (!hasAnyFilter) {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    createdFrom = d.toISOString().split('T')[0];
  } else {
    createdFrom = '';
  }

  // Build search input for server action
  const isOrgWide = boardId === ORG_WIDE_VALUE;

  const pollsResult = await searchPollsAction({
    titleSearch: search || undefined,
    statuses: status ? [status as PollState] : undefined,
    organizationId: orgId || undefined,
    boardId: isOrgWide ? undefined : boardId || undefined,
    orgWideOnly: isOrgWide || undefined,
    createdFrom: createdFrom || undefined,
    createdTo: createdTo || undefined,
    startFrom: startFrom || undefined,
    startTo: startTo || undefined,
    page,
    pageSize,
  });

  const polls = pollsResult.success ? pollsResult.data.polls : [];
  const totalCount = pollsResult.success ? pollsResult.data.totalCount : 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Resolve org name + boards if orgId is set
  let selectedOrg: { id: string; name: string } | null = null;
  let initialBoards: Array<{ id: string; name: string }> = [];

  if (orgId) {
    const [orgResult, boardsResult] = await Promise.all([
      prisma.organization.findUnique({
        where: { id: orgId },
        select: { id: true, name: true },
      }),
      getBoardsByOrganizationAction(orgId),
    ]);

    if (orgResult) {
      selectedOrg = orgResult;
    }

    if (boardsResult.success) {
      initialBoards = boardsResult.data;
    }
  }

  return (
    <AuthenticatedLayout>
      <div className="space-y-8">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Heading className="text-3xl font-bold">
              {isSuperAdmin ? t('allPolls') : t('title')}
            </Heading>
            <Subheading>{isSuperAdmin ? t('title') : t('myPolls')}</Subheading>
          </div>
          <Link href="/polls/create">
            <Button color="brand-green" disabled={!hasOrgMembership}>
              <PlusIcon className="mr-2 h-5 w-5" />
              {t('createPoll')}
            </Button>
          </Link>
        </div>

        {/* No org membership warning */}
        {!hasOrgMembership && !isSuperAdmin && (
          <div className="rounded-lg bg-yellow-50 p-4 dark:bg-yellow-900/20">
            <p className="text-sm text-yellow-800 dark:text-yellow-200">
              {t('noOrgMembership')}
            </p>
          </div>
        )}

        <PollsListUrl
          polls={polls}
          totalCount={totalCount}
          totalPages={totalPages}
          currentPage={page}
          pageSize={pageSize}
          filters={{
            search,
            status,
            orgId,
            boardId,
            createdFrom,
            createdTo,
            startFrom,
            startTo,
          }}
          selectedOrg={selectedOrg}
          initialBoards={initialBoards}
          userId={user.id}
          adminOrgIds={adminOrgIds}
          isSuperAdmin={isSuperAdmin}
        />
      </div>
    </AuthenticatedLayout>
  );
}
