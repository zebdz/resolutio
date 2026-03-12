'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
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

  const handleJoin = async () => {
    setIsJoining(true);

    const formData = new FormData();
    formData.append('organizationId', organizationId);

    const result = await joinOrganizationAction(formData);

    if (result.success) {
      toast.success(t('joinRequestSent'));
      router.refresh();
    } else {
      toast.error(result.error);
    }

    setIsJoining(false);
  };

  return (
    <Button
      color="brand-green"
      onClick={handleJoin}
      disabled={isJoining}
      className="w-full sm:w-auto"
    >
      {isJoining ? t('joining') : t('joinOrganization')}
    </Button>
  );
}
