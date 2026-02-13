'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { cancelJoinParentRequestAction } from '@/web/actions/joinParentRequest';

interface CancelJoinParentButtonProps {
  requestId: string;
}

export function CancelJoinParentButton({
  requestId,
}: CancelJoinParentButtonProps) {
  const t = useTranslations('organization.joinParent');
  const router = useRouter();
  const [isCancelling, setIsCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCancel = async () => {
    setIsCancelling(true);
    setError(null);

    const result = await cancelJoinParentRequestAction(requestId);

    if (result.success) {
      router.refresh();
    } else {
      setError(result.error);
      setIsCancelling(false);
    }
  };

  return (
    <div>
      <Button color="red" onClick={handleCancel} disabled={isCancelling}>
        {isCancelling ? t('cancelling') : t('cancelRequest')}
      </Button>
      {error && (
        <p className="mt-2 text-sm text-red-800 dark:text-red-200">{error}</p>
      )}
    </div>
  );
}
