'use client';

import { useState, useCallback, useTransition } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getBoardsByOrganizationAction } from '@/src/web/actions/board/board';
import { searchOrganizationsForFilterAction } from '@/src/web/actions/organization/organization';
import { PollsListView } from './PollsListView';

const DEFAULT_PAGE_SIZE = 10;

interface PollFilters {
  search: string;
  status: string;
  orgId: string;
  boardId: string;
  createdFrom: string;
  createdTo: string;
  startFrom: string;
  startTo: string;
}

interface PollsListUrlProps {
  polls: any[];
  totalCount: number;
  totalPages: number;
  currentPage: number;
  pageSize: number;
  filters: PollFilters;
  selectedOrg: { id: string; name: string } | null;
  initialBoards: Array<{ id: string; name: string }>;
  userId: string;
  adminOrgIds: string[];
  isSuperAdmin: boolean;
}

export function PollsListUrl({
  polls,
  totalCount,
  totalPages,
  currentPage,
  pageSize,
  filters,
  selectedOrg: initialSelectedOrg,
  initialBoards,
  userId,
  adminOrgIds,
  isSuperAdmin,
}: PollsListUrlProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  // Local search value for debounce
  const [searchValue, setSearchValue] = useState(filters.search);
  const [searchTimer, setSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  // Boards state — fetched when org changes
  const [boards, setBoards] =
    useState<Array<{ id: string; name: string }>>(initialBoards);

  // Org combobox state
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string;
    name: string;
  } | null>(initialSelectedOrg);
  const [orgOptions, setOrgOptions] = useState<
    Array<{ id: string; name: string }>
  >(initialSelectedOrg ? [initialSelectedOrg] : []);
  const [orgSearchTimer, setOrgSearchTimer] = useState<ReturnType<
    typeof setTimeout
  > | null>(null);

  const handleOrgSearch = (query: string) => {
    if (orgSearchTimer) {
      clearTimeout(orgSearchTimer);
    }

    if (query.length < 2) {
      setOrgOptions(selectedOrg ? [selectedOrg] : []);

      return;
    }

    const timer = setTimeout(async () => {
      const result = await searchOrganizationsForFilterAction({ query });

      if (result.success) {
        setOrgOptions(result.data);
      }
    }, 300);
    setOrgSearchTimer(timer);
  };

  // Build URL with updated params
  const buildUrl = useCallback(
    (updates: Partial<PollFilters> & { page?: number; pageSize?: number }) => {
      const params = new URLSearchParams();
      const merged = { ...filters, ...updates };

      if (merged.search) {
        params.set('search', merged.search);
      }

      if (merged.status) {
        params.set('status', merged.status);
      }

      if (merged.orgId) {
        params.set('orgId', merged.orgId);
      }

      if (merged.boardId) {
        params.set('boardId', merged.boardId);
      }

      // Always include createdFrom so the server knows not to apply
      // the one-week-ago default (server checks sp.createdFrom !== undefined)
      params.set('createdFrom', merged.createdFrom);

      if (merged.createdTo) {
        params.set('createdTo', merged.createdTo);
      }

      if (merged.startFrom) {
        params.set('startFrom', merged.startFrom);
      }

      if (merged.startTo) {
        params.set('startTo', merged.startTo);
      }

      const p = updates.page ?? 1;

      if (p > 1) {
        params.set('page', String(p));
      }

      const ps = updates.pageSize ?? pageSize;

      if (ps !== DEFAULT_PAGE_SIZE) {
        params.set('pageSize', String(ps));
      }

      const qs = params.toString();

      return qs ? `${pathname}?${qs}` : pathname;
    },
    [filters, pathname, pageSize]
  );

  const navigateWithFilter = useCallback(
    (updates: Partial<PollFilters>) => {
      startTransition(() => {
        router.push(buildUrl({ ...updates, page: 1 }));
      });
    },
    [buildUrl, router, startTransition]
  );

  // Debounced search
  const handleSearchChange = (value: string) => {
    setSearchValue(value);

    if (searchTimer) {
      clearTimeout(searchTimer);
    }

    const timer = setTimeout(() => {
      navigateWithFilter({ search: value });
    }, 300);
    setSearchTimer(timer);
  };

  // Org change — update selected, fetch boards, navigate
  const handleOrganizationChange = async (orgId: string) => {
    if (!orgId) {
      setSelectedOrg(null);
      setBoards([]);
      navigateWithFilter({ orgId: '', boardId: '' });

      return;
    }

    const org = orgOptions.find((o) => o.id === orgId) ?? null;
    setSelectedOrg(org);
    navigateWithFilter({ orgId, boardId: '' });

    const result = await getBoardsByOrganizationAction(orgId);

    if (result.success) {
      setBoards(result.data);
    } else {
      setBoards([]);
    }
  };

  // Pagination
  const handlePageChange = (page: number) => {
    startTransition(() => {
      router.push(buildUrl({ page }));
    });
  };

  const handlePageSizeChange = (size: number) => {
    startTransition(() => {
      router.push(buildUrl({ page: 1, pageSize: size }));
    });
  };

  // Reset — navigate to bare pathname; server re-applies createdFrom default
  const handleResetFilters = () => {
    setSearchValue('');
    setSelectedOrg(null);
    setOrgOptions([]);
    setBoards([]);
    startTransition(() => {
      router.push(pathname);
    });
  };

  // Poll state change — refresh server data
  const handlePollStateChange = () => {
    router.refresh();
  };

  return (
    <PollsListView
      polls={polls}
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      isPending={isPending}
      searchValue={searchValue}
      status={filters.status}
      organizationId={filters.orgId}
      boardId={filters.boardId}
      createdFrom={filters.createdFrom}
      createdTo={filters.createdTo}
      startFrom={filters.startFrom}
      startTo={filters.startTo}
      selectedOrg={selectedOrg}
      orgOptions={orgOptions}
      onOrgSearch={handleOrgSearch}
      boards={boards}
      userId={userId}
      adminOrgIds={adminOrgIds}
      isSuperAdmin={isSuperAdmin}
      onSearchChange={handleSearchChange}
      onStatusChange={(v) => navigateWithFilter({ status: v })}
      onOrganizationChange={handleOrganizationChange}
      onBoardChange={(v) => navigateWithFilter({ boardId: v })}
      onCreatedFromChange={(v) => navigateWithFilter({ createdFrom: v })}
      onCreatedToChange={(v) => navigateWithFilter({ createdTo: v })}
      onStartFromChange={(v) => navigateWithFilter({ startFrom: v })}
      onStartToChange={(v) => navigateWithFilter({ startTo: v })}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      onResetFilters={handleResetFilters}
      onPollStateChange={handlePollStateChange}
    />
  );
}
