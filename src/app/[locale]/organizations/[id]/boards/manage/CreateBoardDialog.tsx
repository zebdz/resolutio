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
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { Input } from '@/app/components/catalyst/input';
import { createBoardAction } from '@/web/actions/board';

type CreateBoardDialogProps = {
  organizationId: string;
};

export default function CreateBoardDialog({
  organizationId,
}: CreateBoardDialogProps) {
  const t = useTranslations('organization.boards.manage');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [boardName, setBoardName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!boardName.trim()) {
      return;
    }

    setIsCreating(true);
    setError(null);

    const formData = new FormData();
    formData.append('name', boardName);
    formData.append('organizationId', organizationId);

    const result = await createBoardAction(formData);

    if (result.success) {
      setIsOpen(false);
      setBoardName('');
      router.refresh();
    } else {
      setError(result.error);
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button color="indigo" onClick={() => setIsOpen(true)}>
        {t('createBoard')}
      </Button>

      <Dialog open={isOpen} onClose={() => setIsOpen(false)}>
        <DialogTitle>{t('createBoard')}</DialogTitle>
        <DialogDescription>
          {t('subtitle', { organization: '' })}
        </DialogDescription>
        <DialogBody>
          <Field>
            <Label>{t('boardName')}</Label>
            <Input
              name="boardName"
              value={boardName}
              onChange={(e) => setBoardName(e.target.value)}
              placeholder={t('boardName')}
              disabled={isCreating}
              autoFocus
            />
          </Field>
          {error && (
            <div className="mt-2 text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </DialogBody>
        <DialogActions>
          <Button plain onClick={() => setIsOpen(false)} disabled={isCreating}>
            {tCommon('cancel')}
          </Button>
          <Button
            color="indigo"
            onClick={handleCreate}
            disabled={isCreating || !boardName.trim()}
          >
            {isCreating ? tCommon('creating') : t('createBoard')}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
