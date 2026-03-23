'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Field, Label } from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { createBoardAction } from '@/src/web/actions/board/board';

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
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >();

  const handleCreate = async () => {
    if (!boardName.trim()) {
      return;
    }

    setIsCreating(true);
    setError(null);
    setFieldErrors(undefined);

    const formData = new FormData();
    formData.append('name', boardName);
    formData.append('organizationId', organizationId);

    const result = await createBoardAction(formData);

    if (result.success) {
      setIsCreating(false);
      setIsOpen(false);
      setBoardName('');
      router.refresh();
    } else {
      setError(result.error);
      setFieldErrors(result.fieldErrors);
      setIsCreating(false);
    }
  };

  return (
    <>
      <Button
        color="brand-green"
        onClick={() => {
          setIsOpen(true);
          setError(null);
          setFieldErrors(undefined);
        }}
      >
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
              invalid={!!fieldErrors?.name}
              onChange={(e) => {
                setBoardName(e.target.value);
                setFieldErrors(undefined);
              }}
              placeholder={t('boardName')}
              disabled={isCreating}
              autoFocus
            />
            {fieldErrors?.name && (
              <p className="text-sm text-red-600">{fieldErrors.name[0]}</p>
            )}
          </Field>
          {error && !fieldErrors && (
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
            color="brand-green"
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
