'use client';

// PDF export button for the org Ownership view. Hits the same auth-gated
// route the table uses, with the table's current filter state passed as
// query params so the export reflects exactly what the admin sees on screen.
// The route enforces "org admin or superadmin only" — this component just
// renders the trigger.

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { Button } from '@/src/web/components/catalyst/button';

interface Props {
  organizationId: string;
  activeOnly: boolean;
  ownerQuery: string;
  assetQuery: string;
}

export function OwnershipExportPdfButton({
  organizationId,
  activeOnly,
  ownerQuery,
  assetQuery,
}: Props) {
  const t = useTranslations('propertyAdmin.ownership.pdf');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);

    try {
      const params = new URLSearchParams({
        locale,
        activeOnly: String(activeOnly),
      });

      if (ownerQuery) {
        params.set('ownerQuery', ownerQuery);
      }

      if (assetQuery) {
        params.set('assetQuery', assetQuery);
      }

      const response = await fetch(
        `/api/organizations/${organizationId}/ownership/pdf?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error('PDF generation failed');
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      const disposition = response.headers.get('Content-Disposition');
      const filenameMatch = disposition?.match(/filename="(.+?)"/);
      a.download = filenameMatch?.[1] ?? 'ownership.pdf';

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Ownership PDF export error:', error);
      toast.error(tCommon('error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      color="zinc"
      onClick={handleExport}
      disabled={loading}
    >
      {loading ? t('exporting') : t('exportPdf')}
    </Button>
  );
}
