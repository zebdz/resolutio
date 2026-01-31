'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { Textarea } from '@/app/components/catalyst/textarea';
import { removeBoardMemberAction } from '@/web/actions/board';

type Member = {
  id: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
};

type MembersListProps = {
  boardId: string;
  members: Member[];
};

export default function MembersList({ boardId, members }: MembersListProps) {
  const t = useTranslations('organization.boards.manageSingle');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<Member | null>(null);
  const [reason, setReason] = useState('');
  const [isRemoving, setIsRemoving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRemoveClick = (member: Member) => {
    setSelectedMember(member);
    setReason('');
    setError(null);
    setIsDialogOpen(true);
  };

  const handleRemove = async () => {
    if (!selectedMember) {
      return;
    }

    setIsRemoving(true);
    setError(null);

    const formData = new FormData();
    formData.append('boardId', boardId);
    formData.append('userId', selectedMember.id);

    if (reason) {
      formData.append('reason', reason);
    }

    const result = await removeBoardMemberAction(formData);

    if (result.success) {
      setIsDialogOpen(false);
      setSelectedMember(null);
      router.refresh();
    } else {
      setError(result.error);
      setIsRemoving(false);
    }
  };

  if (members.length === 0) {
    return (
      <div className="text-center text-zinc-500 dark:text-zinc-400">
        {t('noMembers')}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {members.map((member) => (
          <div
            key={member.id}
            className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  {member.firstName} {member.lastName}
                </h4>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {member.phoneNumber}
                </p>
              </div>
              <div>
                <Button color="red" onClick={() => handleRemoveClick(member)}>
                  {t('removeMember')}
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Remove Member Dialog */}
      <Dialog open={isDialogOpen} onClose={() => setIsDialogOpen(false)}>
        <DialogTitle>{t('removeDialogTitle')}</DialogTitle>
        <DialogDescription>
          {selectedMember &&
            t('removeDialogDescription', {
              name: `${selectedMember.firstName} ${selectedMember.lastName}`,
            })}
        </DialogDescription>
        <DialogBody>
          <div className="space-y-2">
            <label
              htmlFor="reason"
              className="text-sm font-medium text-zinc-900 dark:text-zinc-100"
            >
              {t('removalReasonLabel')}
            </label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('removalReasonPlaceholder')}
              rows={4}
              disabled={isRemoving}
            />
          </div>
          {error && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button
            plain
            onClick={() => setIsDialogOpen(false)}
            disabled={isRemoving}
          >
            {tCommon('cancel')}
          </Button>
          <Button color="red" onClick={handleRemove} disabled={isRemoving}>
            {isRemoving ? t('removing') : t('confirmRemove')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
