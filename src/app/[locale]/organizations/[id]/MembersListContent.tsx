'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import { User } from '@/domain/user/User';
import { getOrgMembersAction } from '@/src/web/actions/invitation/invitation';
import { removeOrgMemberAction } from '@/src/web/actions/organization/organization';

export type OrgMember = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  joinedAt: Date | null;
};

type Props = {
  organizationId: string;
  initialMembers: OrgMember[];
  initialTotalCount: number;
  canRemoveMembers?: boolean;
  currentUserId?: string | null;
};

const PAGE_SIZE = 20;

export function MembersListContent({
  organizationId,
  initialMembers,
  initialTotalCount,
  canRemoveMembers = false,
  currentUserId = null,
}: Props) {
  const t = useTranslations('organization.detail');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [members, setMembers] = useState<OrgMember[]>(initialMembers);
  const [totalCount, setTotalCount] = useState(initialTotalCount);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState<OrgMember | null>(null);
  const [removeReason, setRemoveReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const from = totalCount === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, totalCount);

  const fetchMembers = useCallback(
    async (p: number, q: string) => {
      setIsLoading(true);
      const result = await getOrgMembersAction(
        organizationId,
        p,
        PAGE_SIZE,
        q || undefined
      );

      if (result.success) {
        setMembers(result.data.members);
        setTotalCount(result.data.totalCount);
      }

      setIsLoading(false);
    },
    [organizationId]
  );

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1);
      fetchMembers(1, query);
    }, 300);

    return () => clearTimeout(timer);
  }, [query, fetchMembers]);

  // Page changes
  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    fetchMembers(newPage, query);
  };

  const handleRemoveClick = (member: OrgMember) => {
    setMemberToRemove(member);
    setRemoveReason('');
    setRemoveError(null);
  };

  const handleRemoveConfirm = async () => {
    if (!memberToRemove) {
      return;
    }

    setIsRemoving(true);
    setRemoveError(null);

    const result = await removeOrgMemberAction(
      organizationId,
      memberToRemove.id,
      removeReason
    );

    setIsRemoving(false);

    if (result.success) {
      setMemberToRemove(null);
      fetchMembers(page, query);
      // Refresh server data so the parent's member-count badge (rendered from a
      // server prop, outside this component's state) reflects the removal.
      router.refresh();
    } else {
      setRemoveError(result.error);
    }
  };

  return (
    <div>
      {/* Search */}
      <div className="mb-4">
        <Input
          type="text"
          placeholder={t('searchMembers')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Members list */}
      {isLoading ? (
        <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          ...
        </div>
      ) : members.length === 0 ? (
        <div className="py-4 text-center text-sm text-zinc-500 dark:text-zinc-400">
          {t('noMembersFound')}
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
          {members.map((member) => (
            <li
              key={member.id}
              className="flex items-center justify-between gap-3 py-2 text-sm text-zinc-700 dark:text-zinc-300"
            >
              <span>
                {User.formatFullName(
                  member.firstName,
                  member.lastName,
                  member.middleName
                )}{' '}
                <span className="text-zinc-400">(@{member.nickname})</span>
              </span>
              {canRemoveMembers && member.id !== currentUserId && (
                <Button color="red" onClick={() => handleRemoveClick(member)}>
                  {t('removeMember')}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* Pagination */}
      {totalCount > 0 && (
        <div className="mt-4 flex flex-col items-center justify-between gap-2 sm:flex-row">
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('showingMembers', { from, to, total: totalCount })}
          </span>
          <div className="flex gap-2">
            <Button
              plain
              disabled={page <= 1}
              onClick={() => handlePageChange(page - 1)}
            >
              {t('previousPage')}
            </Button>
            <Button
              plain
              disabled={page >= totalPages}
              onClick={() => handlePageChange(page + 1)}
            >
              {t('nextPage')}
            </Button>
          </div>
        </div>
      )}

      {/* Remove member dialog */}
      {canRemoveMembers && (
        <Dialog
          open={memberToRemove !== null}
          onClose={() => setMemberToRemove(null)}
        >
          <DialogTitle>{t('removeMemberDialogTitle')}</DialogTitle>
          <DialogDescription>
            {memberToRemove &&
              t('removeMemberDialogDescription', {
                name: User.formatFullName(
                  memberToRemove.firstName,
                  memberToRemove.lastName,
                  memberToRemove.middleName
                ),
              })}
          </DialogDescription>
          <DialogBody>
            <div className="space-y-2">
              <label
                htmlFor="remove-member-reason"
                className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
              >
                {t('removeMemberReasonLabel')}
              </label>
              <Textarea
                id="remove-member-reason"
                value={removeReason}
                onChange={(e) => setRemoveReason(e.target.value)}
                placeholder={t('removeMemberReasonPlaceholder')}
                rows={4}
                maxLength={500}
                disabled={isRemoving}
              />
            </div>
            {removeError && (
              <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                {removeError}
              </div>
            )}
          </DialogBody>
          <DialogActions>
            <Button
              plain
              onClick={() => setMemberToRemove(null)}
              disabled={isRemoving}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              color="red"
              onClick={handleRemoveConfirm}
              disabled={isRemoving || removeReason.trim().length === 0}
            >
              {isRemoving ? t('removingMember') : t('removeMemberConfirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
