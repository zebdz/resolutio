'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Button } from '@/src/web/components/catalyst/button';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
import { Divider } from '@/src/web/components/catalyst/divider';
import { Link } from '@/src/i18n/routing';
import { getUserOrganizationsAction } from '@/src/web/actions/organization/organization';
import { getUserBoardsForHomeAction } from '@/src/web/actions/board/board';
import { LeaveBoardDialog } from './LeaveBoardDialog';
import { LeaveOrganizationDialog } from './LeaveOrganizationDialog';

interface UserOrganization {
  id: string;
  name: string;
  description: string;
  joinedAt?: Date;
  archivedAt?: Date | null;
  parentOrg?: { id: string; name: string } | null;
  hasProperties?: boolean;
}

interface AdminOrganization {
  id: string;
  name: string;
  description: string;
  archivedAt?: Date | null;
  parentOrg?: { id: string; name: string } | null;
}

interface BoardInfo {
  id: string;
  name: string;
}

interface ExternalBoard {
  id: string;
  name: string;
  organizationId: string;
  organizationName: string;
}

interface UserOrganizationsListProps {
  adminOrganizations: AdminOrganization[];
}

export function UserOrganizationsList({
  adminOrganizations,
}: UserOrganizationsListProps) {
  const t = useTranslations('home');
  const tOrg = useTranslations('organization');
  const tShortcut = useTranslations('propertyClaim.shortcut');
  const [member, setMember] = useState<UserOrganization[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [boardsByOrgId, setBoardsByOrgId] = useState<
    Record<string, BoardInfo[]>
  >({});
  const [externalBoards, setExternalBoards] = useState<ExternalBoard[]>([]);
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const [leaveBoardDialog, setLeaveBoardDialog] = useState<{
    isOpen: boolean;
    board: BoardInfo;
  }>({ isOpen: false, board: { id: '', name: '' } });

  const [leaveOrgDialog, setLeaveOrgDialog] = useState<{
    isOpen: boolean;
    organization: { id: string; name: string };
    boards: BoardInfo[];
  }>({ isOpen: false, organization: { id: '', name: '' }, boards: [] });

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);

      const [orgsResult, boardsResult] = await Promise.all([
        getUserOrganizationsAction(),
        getUserBoardsForHomeAction(),
      ]);

      if (orgsResult.success) {
        setMember(
          orgsResult.data.member.map((org) => ({
            ...org,
            joinedAt: new Date(org.joinedAt),
            archivedAt: org.archivedAt ? new Date(org.archivedAt) : null,
            parentOrg: org.parentOrg,
            hasProperties: org.hasProperties,
          }))
        );
      } else {
        setError(orgsResult.error);
      }

      if (boardsResult.success) {
        setBoardsByOrgId(boardsResult.data.boardsByOrgId);
        setExternalBoards(boardsResult.data.externalBoards);
      }

      setIsLoading(false);
    };

    loadData();
  }, [adminOrganizations]);

  const toggleExpanded = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const next = new Set(prev);

      if (next.has(orgId)) {
        next.delete(orgId);
      } else {
        next.add(orgId);
      }

      return next;
    });
  };

  if (isLoading) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <Text className="text-center text-zinc-500">Loading...</Text>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 dark:border-red-900 dark:bg-red-950">
        <Text className="text-red-800 dark:text-red-200">{error}</Text>
      </div>
    );
  }

  const memberIds = new Set(member.map((org) => org.id));
  const adminOnlyOrgs = adminOrganizations.filter(
    (org) => !memberIds.has(org.id)
  );
  const adminIdSet = new Set(adminOrganizations.map((org) => org.id));

  const hasOrganizations = member.length > 0 || adminOnlyOrgs.length > 0;

  if (!hasOrganizations && externalBoards.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <Text className="text-lg text-zinc-500 dark:text-zinc-400">
          {t('noOrganizations')}
        </Text>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Member Organizations */}
      {member.length > 0 && (
        <div>
          <Heading level={2} className="mb-4">
            {t('myOrganizations')}
          </Heading>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {member.map((org) => {
              const orgBoards = boardsByOrgId[org.id] || [];
              const isExpanded = expandedOrgs.has(org.id);

              return (
                <div
                  key={org.id}
                  className={`rounded-lg border p-6 ${
                    org.archivedAt
                      ? 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                  }`}
                >
                  <Link
                    href={`/organizations/${org.id}`}
                    prefetch={false}
                    className="block transition-shadow hover:shadow-md"
                  >
                    {org.parentOrg && (
                      <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                        {tOrg('parentOrg', { name: org.parentOrg.name })}
                      </Text>
                    )}
                    <div className="flex items-start justify-between">
                      <Heading level={3} className="text-lg font-semibold">
                        {org.name}
                      </Heading>
                      <div className="flex gap-1">
                        {org.archivedAt && (
                          <Badge color="pink">{t('archivedBadge')}</Badge>
                        )}
                        {adminIdSet.has(org.id) && (
                          <Badge color="purple">{t('admin')}</Badge>
                        )}
                        <Badge color="green">{t('member')}</Badge>
                      </div>
                    </div>
                    <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                      {org.description}
                    </Text>
                    {org.joinedAt && (
                      <Text className="mt-4 text-xs text-zinc-500 dark:text-zinc-500">
                        {t('joinedAt')} {org.joinedAt.toLocaleDateString()}
                      </Text>
                    )}
                  </Link>

                  {/* Collapsible boards section */}
                  {orgBoards.length > 0 && (
                    <div className="mt-4 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                      <button
                        onClick={() => toggleExpanded(org.id)}
                        className="flex w-full cursor-pointer items-center justify-between text-sm font-medium text-zinc-700 dark:text-zinc-300"
                      >
                        <span>
                          {t('myBoards')} ({orgBoards.length})
                        </span>
                        <svg
                          className={`h-4 w-4 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 9l-7 7-7-7"
                          />
                        </svg>
                      </button>
                      {isExpanded && (
                        <ul className="mt-2 space-y-2">
                          {orgBoards.map((board) => (
                            <li
                              key={board.id}
                              className="flex items-center justify-between rounded-md bg-zinc-50 px-3 py-2 dark:bg-zinc-800"
                            >
                              <Text className="text-sm">{board.name}</Text>
                              <Button
                                color="red"
                                className="!px-2 !py-1 !text-xs"
                                onClick={() =>
                                  setLeaveBoardDialog({
                                    isOpen: true,
                                    board,
                                  })
                                }
                              >
                                {t('leaveBoard')}
                              </Button>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}

                  {/* Claim property shortcut */}
                  {org.hasProperties && !org.archivedAt && (
                    <div className="mt-3 flex justify-start">
                      <Link
                        href={`/organizations/${org.id}#properties`}
                        prefetch={false}
                      >
                        <Button
                          color="brand-green"
                          className="!px-2 !py-1 !text-xs"
                        >
                          {tShortcut('claim')}
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Leave organization button */}
                  {!org.archivedAt && (
                    <div className="mt-3 flex justify-start">
                      <Button
                        color="red"
                        className="!px-2 !py-1 !text-xs"
                        onClick={() =>
                          setLeaveOrgDialog({
                            isOpen: true,
                            organization: { id: org.id, name: org.name },
                            boards: orgBoards,
                          })
                        }
                      >
                        {t('leaveOrganization')}
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Admin-only Organizations */}
      {adminOnlyOrgs.length > 0 && (
        <>
          {member.length > 0 && <Divider className="my-8" />}
          <div>
            <Heading level={2} className="mb-4">
              {t('myAdminOrganizations')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {adminOnlyOrgs.map((org) => (
                <Link
                  key={org.id}
                  href={`/organizations/${org.id}`}
                  prefetch={false}
                  className={`block rounded-lg border p-6 transition-shadow hover:shadow-md ${
                    org.archivedAt
                      ? 'border-pink-200 bg-pink-50 dark:border-pink-900 dark:bg-pink-950'
                      : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900'
                  }`}
                >
                  {org.parentOrg && (
                    <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                      {tOrg('parentOrg', { name: org.parentOrg.name })}
                    </Text>
                  )}
                  <div className="flex items-start justify-between">
                    <Heading level={3} className="text-lg font-semibold">
                      {org.name}
                    </Heading>
                    <div className="flex gap-1">
                      {org.archivedAt && (
                        <Badge color="pink">{t('archivedBadge')}</Badge>
                      )}
                      <Badge color="purple">{t('admin')}</Badge>
                    </div>
                  </div>
                  <Text className="mt-2 line-clamp-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {org.description}
                  </Text>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}

      {/* External Boards */}
      {externalBoards.length > 0 && (
        <>
          <Divider className="my-8" />
          <div>
            <Heading level={2} className="mb-4">
              {t('externalBoards')}
            </Heading>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {externalBoards.map((board) => (
                <div
                  key={board.id}
                  className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <Text className="mb-1 text-xs text-zinc-500 dark:text-zinc-400">
                    {board.organizationName}
                  </Text>
                  <Heading level={3} className="text-lg font-semibold">
                    {board.name}
                  </Heading>
                  <div className="mt-4">
                    <Button
                      color="red"
                      className="w-full !text-sm"
                      onClick={() =>
                        setLeaveBoardDialog({
                          isOpen: true,
                          board: { id: board.id, name: board.name },
                        })
                      }
                    >
                      {t('leaveBoard')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Dialogs */}
      <LeaveBoardDialog
        isOpen={leaveBoardDialog.isOpen}
        onClose={() =>
          setLeaveBoardDialog({ isOpen: false, board: { id: '', name: '' } })
        }
        board={leaveBoardDialog.board}
      />
      <LeaveOrganizationDialog
        isOpen={leaveOrgDialog.isOpen}
        onClose={() =>
          setLeaveOrgDialog({
            isOpen: false,
            organization: { id: '', name: '' },
            boards: [],
          })
        }
        organization={leaveOrgDialog.organization}
        boards={leaveOrgDialog.boards}
      />
    </div>
  );
}
