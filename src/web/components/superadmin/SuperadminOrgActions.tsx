'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import {
  archiveOrganizationAction,
  unarchiveOrganizationAction,
} from '@/src/web/actions/organization/organization';
import { ConfirmArchiveDialog } from './ConfirmArchiveDialog';

interface SuperadminOrgActionsProps {
  organizationId: string;
  organizationName: string;
  isArchived: boolean;
  onActionComplete: () => void;
}

export function SuperadminOrgActions({
  organizationId,
  organizationName,
  isArchived,
  onActionComplete,
}: SuperadminOrgActionsProps) {
  const t = useTranslations('superadmin.organizations');
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const action = isArchived ? 'unarchive' : 'archive';

  const handleConfirm = async () => {
    setIsLoading(true);
    setError(null);

    const result = isArchived
      ? await unarchiveOrganizationAction(organizationId)
      : await archiveOrganizationAction(organizationId);

    if (result.success) {
      setIsOpen(false);
      setIsLoading(false);
      onActionComplete();
    } else {
      setError(result.error);
      setIsLoading(false);
    }
  };

  return (
    <>
      <Button
        color={isArchived ? 'brand-green' : 'red'}
        className="mt-4 w-full"
        onClick={() => setIsOpen(true)}
      >
        {isArchived ? t('unarchiveButton') : t('archiveButton')}
      </Button>

      <ConfirmArchiveDialog
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        organizationName={organizationName}
        action={action}
        onConfirm={handleConfirm}
        isLoading={isLoading}
        error={error}
      />
    </>
  );
}
