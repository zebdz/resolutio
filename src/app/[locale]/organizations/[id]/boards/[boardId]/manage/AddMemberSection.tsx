'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { Select } from '@/app/components/catalyst/select';
import { addBoardMemberAction } from '@/web/actions/board';

type AddMemberSectionProps = {
  boardId: string;
  availableUsers: Array<{
    id: string;
    firstName: string;
    lastName: string;
    phoneNumber: string;
  }>;
};

export default function AddMemberSection({
  boardId,
  availableUsers,
}: AddMemberSectionProps) {
  const t = useTranslations('organization.boards.manageSingle');
  const router = useRouter();
  const [selectedUserId, setSelectedUserId] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAdd = async () => {
    if (!selectedUserId) {
      return;
    }

    setIsAdding(true);
    setError(null);

    const formData = new FormData();
    formData.append('boardId', boardId);
    formData.append('userId', selectedUserId);

    const result = await addBoardMemberAction(formData);

    if (result.success) {
      setSelectedUserId('');
      setIsAdding(false);
      router.refresh();
    } else {
      setError(result.error);
      setIsAdding(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
        {t('addMember')}
      </h3>
      <div className="flex gap-4">
        <Field className="flex-1">
          <Label>{t('selectUser')}</Label>
          <Select
            name="userId"
            value={selectedUserId}
            onChange={(e) => setSelectedUserId(e.target.value)}
            disabled={isAdding}
          >
            <option value="">{t('selectUser')}</option>
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.firstName} {user.lastName} ({user.phoneNumber})
              </option>
            ))}
          </Select>
        </Field>
        <div className="flex items-end">
          <Button
            color="indigo"
            onClick={handleAdd}
            disabled={isAdding || !selectedUserId}
          >
            {isAdding ? t('adding') : t('add')}
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
