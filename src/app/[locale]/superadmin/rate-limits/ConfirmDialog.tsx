'use client';

import { Button } from '@/src/web/components/catalyst/button';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  description: string;
  onConfirm: () => void;
  isLoading: boolean;
  error?: string | null;
  confirmLabel: string;
  cancelLabel: string;
  confirmColor?: 'red' | 'brand-green' | 'dark/zinc';
}

export function ConfirmDialog({
  isOpen,
  onClose,
  title,
  description,
  onConfirm,
  isLoading,
  error,
  confirmLabel,
  cancelLabel,
  confirmColor = 'red',
}: ConfirmDialogProps) {
  return (
    <Dialog open={isOpen} onClose={onClose}>
      <DialogTitle>{title}</DialogTitle>
      <DialogDescription>{description}</DialogDescription>
      <DialogBody>
        {error && (
          <div className="text-sm text-red-600 dark:text-red-400">{error}</div>
        )}
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose} disabled={isLoading}>
          {cancelLabel}
        </Button>
        <Button color={confirmColor} onClick={onConfirm} disabled={isLoading}>
          {confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
