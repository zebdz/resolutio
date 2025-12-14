'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { joinOrganizationAction } from '@/web/actions/organization';

interface JoinOrganizationButtonProps {
  organizationId: string;
}

export function JoinOrganizationButton({
  organizationId,
}: JoinOrganizationButtonProps) {
  const t = useTranslations('organization.detail');
  const router = useRouter();
  const [isJoining, setIsJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setIsJoining(true);
    setError(null);

    const formData = new FormData();
    formData.append('organizationId', organizationId);

    const result = await joinOrganizationAction(formData);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
      setIsJoining(false);
    }
  };

  return (
    <div className="space-y-4">
      <Button
        color="blue"
        onClick={handleJoin}
        disabled={isJoining}
        className="w-full sm:w-auto"
      >
        {isJoining ? t('joining') : t('joinOrganization')}
      </Button>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-950">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}
    </div>
  );
}
