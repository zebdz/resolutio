'use client';

import { useState, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Checkbox,
  CheckboxField,
  CheckboxGroup,
} from '@/src/web/components/catalyst/checkbox';
import { Label } from '@/src/web/components/catalyst/fieldset';
import { Text } from '@/src/web/components/catalyst/text';
import { leaveOrganizationAction } from '@/src/web/actions/organization/organization';

interface Board {
  id: string;
  name: string;
}

interface LeaveOrganizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  organization: { id: string; name: string };
  boards: Board[];
}

export function LeaveOrganizationDialog({
  isOpen,
  onClose,
  organization,
  boards,
}: LeaveOrganizationDialogProps) {
  const t = useTranslations('home');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const allBoardIds = useMemo(() => new Set(boards.map((b) => b.id)), [boards]);
  const [uncheckedBoardIds, setUncheckedBoardIds] = useState<Set<string>>(
    new Set()
  );

  const isChecked = (boardId: string) =>
    allBoardIds.has(boardId) && !uncheckedBoardIds.has(boardId);

  const toggleBoard = (boardId: string) => {
    setUncheckedBoardIds((prev) => {
      const next = new Set(prev);

      if (next.has(boardId)) {
        next.delete(boardId);
      } else {
        next.add(boardId);
      }

      return next;
    });
  };

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);

    const boardIdsToLeave = boards
      .filter((b) => !uncheckedBoardIds.has(b.id))
      .map((b) => b.id);

    const formData = new FormData();
    formData.set('organizationId', organization.id);
    formData.set('boardIdsToLeave', JSON.stringify(boardIdsToLeave));

    const result = await leaveOrganizationAction(formData);

    if (result.success) {
      onClose();
      router.refresh();
    } else {
      setError(result.error);
    }

    setIsLoading(false);
  };

  const handleClose = () => {
    if (!isLoading) {
      setError(null);
      setUncheckedBoardIds(new Set());
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('leaveOrgConfirmTitle')}</DialogTitle>
      <DialogDescription>
        {t('leaveOrgConfirmDescription', { orgName: organization.name })}
      </DialogDescription>
      <DialogBody>
        {boards.length > 0 && (
          <div className="space-y-3">
            <Text className="text-sm font-medium">
              {t('leaveOrgBoardsPrompt')}
            </Text>
            <CheckboxGroup>
              {boards.map((board) => (
                <CheckboxField key={board.id}>
                  <Checkbox
                    checked={isChecked(board.id)}
                    onChange={() => toggleBoard(board.id)}
                    color="green"
                  />
                  <Label>{board.name}</Label>
                </CheckboxField>
              ))}
            </CheckboxGroup>
          </div>
        )}
        {error && (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400">{error}</p>
        )}
      </DialogBody>
      <DialogActions>
        <Button color="zinc" onClick={handleClose} disabled={isLoading}>
          {tCommon('cancel')}
        </Button>
        <Button color="red" onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? t('leaving') : t('leaveOrganization')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
