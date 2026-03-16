'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { joinViaTokenAction } from '@/web/actions/joinToken';
import { toast } from 'sonner';

export function JoinConfirmButton({ token }: { token: string }) {
  const t = useTranslations('joinToken.page');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    startTransition(async () => {
      const formData = new FormData();
      formData.set('token', token);
      const result = await joinViaTokenAction(formData);

      if (!result.success) {
        setError(result.error);
      } else {
        toast.success(t('requestSent'));
        router.push(`/organizations/${result.data.organizationId}`);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && <AlertBanner color="red">{error}</AlertBanner>}
      <Button
        color="brand-green"
        className="w-full"
        onClick={handleConfirm}
        disabled={isPending}
      >
        {isPending ? t('confirming') : t('confirmButton')}
      </Button>
    </div>
  );
}
