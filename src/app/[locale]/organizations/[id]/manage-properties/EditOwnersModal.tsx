'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { ErrorBanner } from '@/src/web/components/shared/ErrorBanner';
import {
  listActiveOwnershipForAssetAction,
  replaceAssetOwnersAction,
} from '@/src/web/actions/organization/property';
import { MemberSearchInput } from './MemberSearchInput';

// `share` is held as a percentage string (0..100) for the UI; the backend
// expects the canonical 0..1 fraction, so we convert at the save boundary.
// Admins think in percent — typing "50" instead of "0.5" matches expectations.
type Row =
  | {
      kind: 'user';
      userId: string;
      // Pre-fetched display label so the row shows the member name on first
      // render instead of the raw cuid. Empty for newly-added rows.
      userLabel: string;
      share: string;
    }
  | { kind: 'external'; label: string; share: string };

function fractionToPercentString(fraction: number): string {
  // Up to 4 decimals of percent (= 0.000001 of fraction); trim trailing zeros.
  const pct = fraction * 100;
  const rounded = Math.round(pct * 10000) / 10000;

  return String(rounded);
}

export function EditOwnersModal({
  organizationId,
  assetId,
  onClose,
}: {
  organizationId: string;
  assetId: string;
  onClose: () => void;
}) {
  const t = useTranslations('propertyAdmin.editOwners');
  const [rows, setRows] = useState<Row[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    (async () => {
      const ownershipRes = await listActiveOwnershipForAssetAction({ assetId });

      if (!ownershipRes.success) {
        setErr(ownershipRes.error);

        return;
      }

      setRows(
        ownershipRes.data.ownerships.map((o) =>
          o.userId
            ? {
                kind: 'user',
                userId: o.userId,
                userLabel: o.userLabel ?? '',
                share: fractionToPercentString(o.share),
              }
            : {
                kind: 'external',
                label: o.externalOwnerLabel ?? '',
                share: fractionToPercentString(o.share),
              }
        )
      );
    })();
  }, [assetId]);

  // Sum is in percent (UI scale). Tolerance scales accordingly: 1e-6 fraction = 1e-4 percent.
  const sum = rows.reduce((s, r) => s + (Number(r.share) || 0), 0);
  const PERCENT_TOLERANCE = 1e-4;
  const validSum =
    Math.abs(sum - 100) <= PERCENT_TOLERANCE || rows.length === 0;
  const hasUnpickedUser = rows.some(
    (r) => r.kind === 'user' && !r.userId.trim()
  );
  const hasEmptyExternalLabel = rows.some(
    (r) => r.kind === 'external' && !r.label.trim()
  );
  const hasZeroShare = rows.some((r) => !(Number(r.share) > 0));

  // Detect client-side duplicates to fail-fast before hitting the server.
  // Mirrors the backend check in ReplaceAssetOwnersUseCase.
  const userIds = rows
    .filter((r): r is Extract<Row, { kind: 'user' }> => r.kind === 'user')
    .map((r) => r.userId.trim())
    .filter((id) => id);
  const labels = rows
    .filter(
      (r): r is Extract<Row, { kind: 'external' }> => r.kind === 'external'
    )
    .map((r) => r.label.trim().toLowerCase())
    .filter((l) => l);
  const hasDuplicateOwner =
    new Set(userIds).size !== userIds.length ||
    new Set(labels).size !== labels.length;

  const canSave =
    validSum &&
    !hasUnpickedUser &&
    !hasEmptyExternalLabel &&
    !hasZeroShare &&
    !hasDuplicateOwner;

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(
      rows.map((r, idx) => (idx === i ? ({ ...r, ...patch } as Row) : r))
    );
  }

  async function save() {
    setErr(null);
    startTransition(async () => {
      const r = await replaceAssetOwnersAction({
        assetId,
        // Convert UI percentages back to canonical 0..1 fractions for the backend.
        owners: rows.map((row) =>
          row.kind === 'user'
            ? {
                kind: 'user',
                userId: row.userId,
                share: (Number(row.share) || 0) / 100,
              }
            : {
                kind: 'external',
                label: row.label,
                share: (Number(row.share) || 0) / 100,
              }
        ),
      });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      onClose();
    });
  }

  return (
    <Dialog open size="2xl" onClose={onClose}>
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogBody>
        <div className="space-y-2">
          {rows.length > 0 && (
            <div className="hidden sm:grid grid-cols-[180px_minmax(0,1fr)_110px_auto] gap-3 px-1 text-xs font-medium uppercase text-zinc-500 dark:text-zinc-400">
              <span>{t('cols.kind')}</span>
              <span>{t('cols.owner')}</span>
              <span>{t('cols.share')}</span>
              <span></span>
            </div>
          )}
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-1 sm:grid-cols-[180px_minmax(0,1fr)_110px_auto] gap-3 items-center"
            >
              <Select
                value={row.kind}
                onChange={(e) =>
                  updateRow(i, {
                    kind: e.target.value as 'user' | 'external',
                    ...(e.target.value === 'user'
                      ? {
                          userId: '',
                          userLabel: '',
                          label: undefined as any,
                        }
                      : {
                          label: '',
                          userId: undefined as any,
                          userLabel: undefined as any,
                        }),
                  })
                }
              >
                <option value="user">{t('kind.user')}</option>
                <option value="external">{t('kind.external')}</option>
              </Select>
              {row.kind === 'user' ? (
                <MemberSearchInput
                  organizationId={organizationId}
                  value={row.userId}
                  initialLabel={row.userLabel || undefined}
                  // Exclude users already picked in OTHER rows so the same
                  // owner can't be added twice. Don't exclude this row's own
                  // userId — the current value needs to stay selectable.
                  excludeUserIds={rows
                    .filter(
                      (other, j) =>
                        j !== i && other.kind === 'user' && other.userId
                    )
                    .map(
                      (other) =>
                        (other as Extract<Row, { kind: 'user' }>).userId
                    )}
                  onChange={(uid, label) =>
                    updateRow(i, {
                      userId: uid,
                      userLabel: label ?? '',
                    })
                  }
                />
              ) : (
                <Input
                  placeholder={t('fields.externalLabel')}
                  value={row.label}
                  onChange={(e) => updateRow(i, { label: e.target.value })}
                />
              )}
              <div className="relative">
                <Input
                  className="pr-8"
                  inputMode="decimal"
                  value={row.share}
                  onChange={(e) => updateRow(i, { share: e.target.value })}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-zinc-500 dark:text-zinc-400">
                  %
                </span>
              </div>
              <Button
                color="red"
                onClick={() => setRows(rows.filter((_, j) => j !== i))}
              >
                {t('remove')}
              </Button>
            </div>
          ))}
          <Button
            plain
            onClick={() =>
              setRows([
                ...rows,
                { kind: 'user', userId: '', userLabel: '', share: '0' },
              ])
            }
          >
            {t('addRow')}
          </Button>
          {validSum ? (
            // Plain <p> instead of Catalyst <Text> so the green color
            // actually renders (Text otherwise overrides with text-zinc-500).
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              {t('totalValid')}
            </p>
          ) : (
            <ErrorBanner
              tone="warning"
              message={t('totalInvalid', {
                percent: parseFloat(sum.toFixed(2)).toString(),
              })}
            />
          )}
          {hasUnpickedUser && (
            <ErrorBanner tone="warning" message={t('pickMemberHint')} />
          )}
          {hasEmptyExternalLabel && (
            <ErrorBanner tone="warning" message={t('externalLabelHint')} />
          )}
          {hasZeroShare && (
            <ErrorBanner tone="warning" message={t('zeroShareHint')} />
          )}
          {hasDuplicateOwner && (
            <ErrorBanner tone="warning" message={t('duplicateOwnerHint')} />
          )}
          <ErrorBanner message={err} />
        </div>
      </DialogBody>
      <DialogActions>
        <Button plain onClick={onClose}>
          {t('cancel')}
        </Button>
        <Button onClick={save} disabled={!canSave || pending}>
          {t('save')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
