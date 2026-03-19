'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/app/components/catalyst/dialog';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { Input } from '@/app/components/catalyst/input';
import { Textarea } from '@/app/components/catalyst/textarea';
import { Button } from '@/app/components/catalyst/button';

interface Participant {
  id: string;
  userName: string;
  weight: number;
}

interface SaveResult {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
}

interface EditWeightDialogProps {
  isOpen: boolean;
  onClose: () => void;
  participant: Participant;
  onSave: (
    participantId: string,
    newWeight: number,
    reason: string
  ) => Promise<SaveResult>;
  isLoading: boolean;
}

export default function EditWeightDialog({
  isOpen,
  onClose,
  participant,
  onSave,
  isLoading,
}: EditWeightDialogProps) {
  const t = useTranslations('poll.participants');
  const [weight, setWeight] = useState(participant.weight.toString());
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >();

  const handleSave = async () => {
    const weightNum = parseFloat(weight);

    if (isNaN(weightNum) || weightNum < 0) {
      setError(t('invalidWeight'));
      setFieldErrors(undefined);

      return;
    }

    if (!reason.trim()) {
      setError('');
      setFieldErrors({ reason: [t('reasonRequired')] });

      return;
    }

    setFieldErrors(undefined);
    setError('');

    const result = await onSave(participant.id, weightNum, reason);

    if (!result.success) {
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      } else if (result.error) {
        setError(result.error);
      }
    }
  };

  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>{t('editWeight')}</DialogTitle>
      <DialogDescription>{participant.userName}</DialogDescription>
      <DialogBody>
        <div className="space-y-4">
          <Field>
            <Label>{t('weight')}</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              value={weight}
              onChange={(e) => {
                setWeight(e.target.value);
                setError('');
                setFieldErrors(undefined);
              }}
              disabled={isLoading}
            />
          </Field>

          <Field>
            <Label>{t('editWeightReason')}</Label>
            <Textarea
              value={reason}
              invalid={!!fieldErrors?.reason}
              onChange={(e) => {
                setReason(e.target.value);
                setError('');
                setFieldErrors(undefined);
              }}
              rows={3}
              disabled={isLoading}
              placeholder={t('editWeightReasonPlaceholder')}
            />
            {fieldErrors?.reason && (
              <p className="text-sm text-red-600">{fieldErrors.reason[0]}</p>
            )}
          </Field>

          {error && !fieldErrors && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button color="zinc" onClick={onClose} disabled={isLoading}>
          {t('cancel')}
        </Button>
        <Button onClick={handleSave} disabled={isLoading}>
          {isLoading ? t('saving') : t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
