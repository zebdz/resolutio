'use client';

import { useState, useEffect, useCallback, useTransition } from 'react';
import {
  searchPollsAction,
  SearchPollsInput,
} from '@/src/web/actions/poll/poll';
import { getBoardsByOrganizationAction } from '@/src/web/actions/board/board';
import { searchOrganizationsForFilterAction } from '@/src/web/actions/organization/organization';
import { PollState } from '@/domain/poll/PollState';
import { PollsListView } from './PollsListView';

const DEFAULT_PAGE_SIZE = 10;
const ORG_WIDE_VALUE = '__org_wide__';

interface PollsListProps {
  initialPolls: any[];
  initialTotalCount: number;
  userId: string;
  adminOrgIds: string[];
  isSuperAdmin: boolean;
  fixedOrganizationId?: string;
  initialBoards?: Array<{ id: string; name: string }>;
}

function oneWeekAgo(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);

  return d.toISOString().split('T')[0];
}

export function PollsList({
  initialPolls,
  initialTotalCount,
  userId,
  adminOrgIds,
  isSuperAdmin,
  fixedOrganizationId,
  initialBoards,
}: PollsListProps) {
  const [isPending, startTransition] = useTransition();

  const [polls, setPolls] = useState(initialPolls);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [nameSearch, setNameSearch] = useState('');
  const [status, setStatus] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [boardId, setBoardId] = useState('');
  const [createdFrom, setCreatedFrom] = useState(oneWeekAgo());
  const [createdTo, setCreatedTo] = useState('');
  const [startFrom, setStartFrom] = useState('');
  const [startTo, setStartTo] = useState('');

  const [boards, setBoards] = useState<Array<{ id: string; name: string }>>(
    initialBoards ?? []
  );

  // Org combobox state
  const [selectedOrg, setSelectedOrg] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [orgOptions, setOrgOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
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

  const handleOrganizationChange = (orgId: string) => {
    const org = orgOptions.find((o) => o.id === orgId) ?? null;
    setSelectedOrg(org);
    setOrganizationId(orgId);
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));

  // Fetch boards when org changes (skip when fixedOrganizationId is set)
  useEffect(() => {
    if (fixedOrganizationId) {
      return;
    }

    if (!organizationId) {
      setBoards([]);
      setBoardId('');

      return;
    }

    getBoardsByOrganizationAction(organizationId).then((result) => {
      if (result.success) {
        setBoards(result.data);
      } else {
        setBoards([]);
      }

      setBoardId('');
    });
  }, [organizationId, fixedOrganizationId]);

  const fetchPolls = useCallback(
    (overrides?: Partial<SearchPollsInput>) => {
      const isOrgWide = boardId === ORG_WIDE_VALUE;
      const input: SearchPollsInput = {
        titleSearch: nameSearch || undefined,
        statuses: status ? [status as PollState] : undefined,
        organizationId: fixedOrganizationId || organizationId || undefined,
        boardId: isOrgWide ? undefined : boardId || undefined,
        orgWideOnly: isOrgWide || undefined,
        createdFrom: createdFrom || undefined,
        createdTo: createdTo || undefined,
        startFrom: startFrom || undefined,
        startTo: startTo || undefined,
        page: currentPage,
        pageSize,
        ...overrides,
      };

      startTransition(async () => {
        const result = await searchPollsAction(input);

        if (result.success) {
          setPolls(result.data.polls);
          setTotalCount(result.data.totalCount);
        }
      });
    },
    [
      nameSearch,
      status,
      fixedOrganizationId,
      organizationId,
      boardId,
      createdFrom,
      createdTo,
      startFrom,
      startTo,
      currentPage,
      pageSize,
    ]
  );

  // Debounced name search — reset to page 1
  useEffect(() => {
    const timer = setTimeout(() => {
      setCurrentPage(1);
      fetchPolls({ page: 1 });
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameSearch]);

  // Immediate fetch on non-debounced filter change — reset to page 1
  useEffect(() => {
    setCurrentPage(1);
    fetchPolls({ page: 1 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    status,
    organizationId,
    boardId,
    createdFrom,
    createdTo,
    startFrom,
    startTo,
  ]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchPolls({ page });
  };

  const handlePageSizeChange = (newSize: number) => {
    setPageSize(newSize);
    setCurrentPage(1);
    fetchPolls({ page: 1, pageSize: newSize });
  };

  const resetFilters = () => {
    setNameSearch('');
    setStatus('');

    if (!fixedOrganizationId) {
      setOrganizationId('');
      setSelectedOrg(null);
      setOrgOptions([]);
    }

    setBoardId('');
    setCreatedFrom(oneWeekAgo());
    setCreatedTo('');
    setStartFrom('');
    setStartTo('');
    setCurrentPage(1);
  };

  return (
    <PollsListView
      polls={polls}
      totalCount={totalCount}
      currentPage={currentPage}
      pageSize={pageSize}
      totalPages={totalPages}
      isPending={isPending}
      searchValue={nameSearch}
      status={status}
      organizationId={organizationId}
      boardId={boardId}
      createdFrom={createdFrom}
      createdTo={createdTo}
      startFrom={startFrom}
      startTo={startTo}
      selectedOrg={selectedOrg}
      orgOptions={orgOptions}
      onOrgSearch={handleOrgSearch}
      boards={boards}
      fixedOrganizationId={fixedOrganizationId}
      userId={userId}
      adminOrgIds={adminOrgIds}
      isSuperAdmin={isSuperAdmin}
      onSearchChange={setNameSearch}
      onStatusChange={setStatus}
      onOrganizationChange={handleOrganizationChange}
      onBoardChange={setBoardId}
      onCreatedFromChange={setCreatedFrom}
      onCreatedToChange={setCreatedTo}
      onStartFromChange={setStartFrom}
      onStartToChange={setStartTo}
      onPageChange={handlePageChange}
      onPageSizeChange={handlePageSizeChange}
      onResetFilters={resetFilters}
      onPollStateChange={fetchPolls}
    />
  );
}
