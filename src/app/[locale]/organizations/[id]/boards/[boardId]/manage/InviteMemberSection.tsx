'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';
import { Select } from '@/src/web/components/catalyst/select';
import { createBoardMemberInviteAction } from '@/web/actions/invitation';
import { User } from '@/domain/user/User';

type InviteMemberSectionProps = {
  boardId: string;
  availableUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    middleName: string | null;
  }>;
};

export default function InviteMemberSection({
  boardId,
  availableUsers,
}: InviteMemberSectionProps) {
  const t = useTranslations('organization.boards.manageSingle');
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isInviting, setIsInviting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleInvite = async () => {
    if (!selectedUserId) {
      return;
    }

    setIsInviting(true);
    setError(null);

    const result = await createBoardMemberInviteAction(boardId, selectedUserId);

    if (result.success) {
      setSelectedUserId('');
      setIsInviting(false);
      router.refresh();
    } else {
      setError(result.error);
      setIsInviting(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        {t('inviteMember')}
      </h3>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Field className="flex-1">
          <Label>{t('selectUser')}</Label>
          <Select
            name="userId"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={isInviting}
          >
            <option value="">{t('selectUser')}</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {User.formatFullName(
                  user.firstName,
                  user.lastName,
                  user.middleName
                )}
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <Button
            className="w-full sm:w-auto"
            color="brand-green"
            onClick={handleInvite}
            disabled={isInviting || !selectedUserId}
          >
            {isInviting ? t('inviting') : t('invite')}
          </Button>
        </div>
      </div>
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
