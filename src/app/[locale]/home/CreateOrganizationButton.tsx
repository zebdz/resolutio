'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import { PlusIcon } from '@heroicons/react/16/solid';
import { CreateOrganizationDialog } from '@/web/components/organization/CreateOrganizationDialog';

interface CreateOrganizationButtonProps {
  locale: string;
}

export function CreateOrganizationButton({
  locale,
}: CreateOrganizationButtonProps) {
  const t = useTranslations('home');
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button color="blue" onClick={() => setIsDialogOpen(true)}>
        <PlusIcon />
        {t('createOrganization')}
      </Button>

      <CreateOrganizationDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
        locale={locale}
      />
    </>
  );
}
