'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogDescription,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { resetUserPasswordAction } from '@/src/web/actions/superadmin/userPassword';

interface ResetPasswordDialogProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  userName: string;
  nickname: string;
}

export function ResetPasswordDialog({
  isOpen,
  onClose,
  userId,
  userName,
  nickname,
}: ResetPasswordDialogProps) {
  const t = useTranslations('superadmin.users');
  const [password, setPassword] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const result = await resetUserPasswordAction({ userId });

      if (result.success) {
        setPassword(result.data.password);
      } else {
        setError(result.error);
      }
    } catch {
      setError(t('passwordResetFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!password) {
      return;
    }

    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard access can be denied (insecure origin, browser policy).
      // The password stays selectable on screen, so say so rather than
      // failing silently.
      setError(t('copyFailed'));
    }
  };

  const handleClose = () => {
    // Drop the plaintext as soon as the dialog closes — it is shown once and
    // there is no way to retrieve it afterwards.
    setPassword(null);
    setError(null);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('changePasswordTitle')}</DialogTitle>
      <DialogDescription>
        {password
          ? t('changePasswordDone', { name: userName })
          : t('changePasswordDescription', { name: userName })}
      </DialogDescription>
      <DialogBody>
        <div className="space-y-3">
          <Text className="text-sm text-zinc-500">@{nickname}</Text>

          {password ? (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <code className="grow select-all rounded-lg bg-zinc-100 px-3 py-2 font-mono text-base tracking-wider text-zinc-950 dark:bg-zinc-800 dark:text-white">
                  {password}
                </code>
                <Button plain onClick={handleCopy}>
                  {copied ? t('copied') : t('copy')}
                </Button>
              </div>
              <Text className="text-sm text-amber-600 dark:text-amber-400">
                {t('passwordShownOnce')}
              </Text>
            </div>
          ) : (
            <Button
              color="red"
              onClick={handleGenerate}
              disabled={isLoading}
              className="w-full sm:w-auto"
            >
              {isLoading ? t('generatingPassword') : t('generatePassword')}
            </Button>
          )}

          {error && (
            <div className="text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={handleClose} disabled={isLoading}>
          {password ? t('close') : t('cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
