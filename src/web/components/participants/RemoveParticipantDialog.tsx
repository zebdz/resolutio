'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { Button } from '@/app/components/catalyst/button';

interface Participant {
  id: string;
  userName: string;
}

interface RemoveParticipantDialogProps {
  isOpen: boolean;
  onClose: () => void;
  participant: Participant;
  onConfirm: (participantId: string) => Promise<void>;
  isLoading: boolean;
}

export default function RemoveParticipantDialog({
  isOpen,
  onClose,
  participant,
  onConfirm,
  isLoading,
}: RemoveParticipantDialogProps) {
  const t = useTranslations('poll.participants');

  const handleConfirm = async () => {
    await onConfirm(participant.id);
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>{t('confirmRemove')}</DialogTitle>
      <DialogDescription>
        {t('confirmRemoveDescription', { name: participant.userName })}
      </DialogDescription>
      <DialogBody>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          {t('confirmRemoveWarning')}
        </p>
      </DialogBody>
      <DialogActions>
        <Button color="zinc" onClick={onClose} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button color="red" onClick={handleConfirm} disabled={isLoading}>
          {isLoading ? t('removing') : t('remove')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
