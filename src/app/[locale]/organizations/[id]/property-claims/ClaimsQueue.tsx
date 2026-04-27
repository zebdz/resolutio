'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import { ErrorBanner } from '@/src/web/components/shared/ErrorBanner';
import {
  approvePropertyClaimAction,
  denyPropertyClaimAction,
} from '@/src/web/actions/organization/propertyClaim';

export interface ClaimRow {
  id: string;
  assetId: string;
  assetName: string;
  propertyId: string;
  propertyName: string;
  claimantFirstName: string;
  claimantLastName: string;
  claimantMiddleName: string | null;
  externalOwnerLabel: string | null;
  createdAt: string;
  attachments: Array<{
    id: string;
    fileName: string;
    mimeType: string;
    sizeBytes: number;
  }>;
  // Active placeholder ownership rows on the claimed asset. When there
  // are 2+ entries the admin must pick which slot the claimant takes
  // before approving — otherwise the backend rejects the request.
  placeholders: Array<{
    ownershipId: string;
    label: string | null;
    sharePercent: number;
  }>;
}

export function ClaimsQueue({ initialRows }: { initialRows: ClaimRow[] }) {
  const t = useTranslations('propertyClaim.admin');
  const [rows, setRows] = useState(initialRows);
  const [denying, setDenying] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);
  // For each multi-placeholder claim, which slot the admin selected.
  // Keyed by claim.id; only set once the admin picks from the dropdown.
  const [chosenPlaceholder, setChosenPlaceholder] = useState<
    Record<string, string>
  >({});
  const [pending, startTransition] = useTransition();

  async function approve(row: ClaimRow) {
    // Multi-placeholder claims need an explicit slot selection — the
    // backend would otherwise reject with REQUIRE_TARGET. Block the click
    // here so the admin sees the requirement before submitting.
    let targetOwnershipId: string | undefined;

    if (row.placeholders.length > 1) {
      targetOwnershipId = chosenPlaceholder[row.id];

      if (!targetOwnershipId) {
        setErr(t('approve.pickPlaceholderFirst'));

        return;
      }
    }

    if (!window.confirm(t('approve.confirm'))) {
      return;
    }

    setErr(null);
    startTransition(async () => {
      const r = await approvePropertyClaimAction({
        claimId: row.id,
        targetOwnershipId,
      });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      setRows(rows.filter((x) => x.id !== row.id));
    });
  }

  async function deny() {
    if (!denying) {
      return;
    }

    setErr(null);
    startTransition(async () => {
      const r = await denyPropertyClaimAction({
        claimId: denying,
        reason,
      });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      setRows(rows.filter((x) => x.id !== denying));
      setDenying(null);
      setReason('');
    });
  }

  // Trust-on-display warning: any claim with an attachment is a user upload.
  // The magic-number gate, MIME whitelist, and CSP sandbox raise the bar but
  // don't make these files safe by themselves — the admin opening the file
  // locally bears the residual risk.
  const hasAnyAttachment = rows.some((r) => r.attachments.length > 0);

  return (
    <div className="space-y-3">
      {hasAnyAttachment && (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
          {t('attachmentTrustWarning')}
        </div>
      )}
      <ErrorBanner message={err} tone="warning" />
      {rows.length === 0 && <Text>{t('empty')}</Text>}
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="py-3 flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="font-medium">
                {r.claimantLastName} {r.claimantFirstName}{' '}
                {r.claimantMiddleName}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {r.propertyName} · {r.assetName}
                {r.externalOwnerLabel && (
                  <>
                    {' '}
                    · {t('label')}: {r.externalOwnerLabel}
                  </>
                )}
              </div>
              <div className="text-xs text-zinc-500">
                {new Date(r.createdAt).toLocaleString()}
              </div>
              {r.attachments.length > 0 && (
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  {r.attachments.map((a) => (
                    <a
                      key={a.id}
                      href={`/api/property-claim-attachments/${a.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cursor-pointer text-brand-green underline"
                    >
                      {`${t('downloadProof')}: ${a.fileName} (${(a.sizeBytes / 1024).toFixed(0)} KB)`}
                    </a>
                  ))}
                </div>
              )}
              {r.placeholders.length > 1 && (
                // Multi-external-owner asset: admin must pick which slot
                // the claimant takes over. Without an explicit choice the
                // 70%/30% attribution would be a coin flip.
                <div className="mt-2">
                  <label className="text-xs text-zinc-600 dark:text-zinc-400">
                    {t('approve.pickPlaceholderLabel')}
                  </label>
                  <select
                    className="ml-2 rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                    value={chosenPlaceholder[r.id] ?? ''}
                    onChange={(e) =>
                      setChosenPlaceholder((prev) => ({
                        ...prev,
                        [r.id]: e.target.value,
                      }))
                    }
                  >
                    <option value="">{t('approve.pickPlaceholderNone')}</option>
                    {r.placeholders.map((p) => (
                      <option key={p.ownershipId} value={p.ownershipId}>
                        {`${p.label ?? '—'} (${p.sharePercent.toFixed(2)}%)`}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
            <Button
              color="brand-green"
              onClick={() => approve(r)}
              disabled={pending}
            >
              {t('approve.button')}
            </Button>
            <Button
              color="red"
              onClick={() => {
                setDenying(r.id);
                setReason('');
              }}
              disabled={pending}
            >
              {t('deny.button')}
            </Button>
          </li>
        ))}
      </ul>
      {denying && (
        <Dialog open onClose={() => setDenying(null)}>
          <DialogTitle>{t('deny.title')}</DialogTitle>
          <DialogBody>
            <Input
              placeholder={t('deny.reasonPlaceholder')}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setDenying(null)}>
              {t('cancel')}
            </Button>
            <Button color="red" onClick={deny} disabled={pending}>
              {t('deny.confirm')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}
