'use client';

import { useEffect, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { ErrorBanner } from '@/src/web/components/shared/ErrorBanner';
import {
  listAssetsAction,
  createAssetAction,
  updateAssetAction,
  archiveAssetAction,
  unarchiveAssetAction,
} from '@/src/web/actions/organization/property';
import { EditOwnersModal } from './EditOwnersModal';

export function AssetsTable({
  organizationId,
  propertyId,
  sizeUnit,
}: {
  organizationId: string;
  propertyId: string;
  sizeUnit: string;
}) {
  const t = useTranslations('propertyAdmin');
  const tUnit = useTranslations('propertyAdmin.sizeUnit');
  const [assets, setAssets] = useState<
    {
      id: string;
      name: string;
      size: number;
      archivedAt: string | null;
    }[]
  >([]);
  const [includeArchived, setIncludeArchived] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({ name: '', size: '' });
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  async function reload() {
    const r = await listAssetsAction({ propertyId, includeArchived });

    if (r.success) {
      setAssets(r.data.assets);
    }
  }

  // Inline async + cancellation flag instead of calling `reload()` directly
  // — the latter trips `react-hooks/set-state-in-effect` and skips cleanup
  // when the user rapidly switches property tabs (stale rows could land).
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const r = await listAssetsAction({ propertyId, includeArchived });

      if (!cancelled && r.success) {
        setAssets(r.data.assets);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [propertyId, includeArchived]);

  async function create() {
    setErr(null);
    const size = Number(newForm.size);

    if (!Number.isFinite(size) || size <= 0) {
      setErr(t('fields.sizeMustBePositive'));

      return;
    }

    startTransition(async () => {
      const r = await createAssetAction({
        propertyId,
        name: newForm.name,
        size,
      });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      setNewForm({ name: '', size: '' });
      await reload();
    });
  }

  async function renameAsset(id: string, name: string) {
    startTransition(async () => {
      const r = await updateAssetAction({ assetId: id, name });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      await reload();
    });
  }

  async function resizeAsset(id: string, size: number) {
    startTransition(async () => {
      const r = await updateAssetAction({ assetId: id, size });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      await reload();
    });
  }

  async function toggleArchive(id: string, archived: boolean) {
    if (!archived && !window.confirm(t('archive.assetConfirm'))) {
      return;
    }

    startTransition(async () => {
      const r = archived
        ? await unarchiveAssetAction({ assetId: id })
        : await archiveAssetAction({ assetId: id });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      await reload();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">{t('assets.heading')}</h3>
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={includeArchived}
            onChange={(e) => setIncludeArchived(e.target.checked)}
          />
          {t('assets.includeArchived')}
        </label>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px_auto] gap-2 items-center">
        <Input
          placeholder={t('fields.assetName')}
          value={newForm.name}
          onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
        />
        <Input
          placeholder={tUnit(toCamel(sizeUnit))}
          value={newForm.size}
          onChange={(e) => setNewForm({ ...newForm, size: e.target.value })}
        />
        <Button onClick={create} disabled={pending}>
          {t('assets.add')}
        </Button>
      </div>
      <ErrorBanner message={err} />
      {/* Mobile: each asset becomes a bordered card with stacked rows so
          name / size / actions don't run together. Desktop falls back to
          the existing 4-column grid via `sm:contents` on the action wrapper. */}
      <ul className="space-y-3 sm:space-y-0 sm:divide-y sm:divide-zinc-200 sm:dark:divide-zinc-800">
        {assets.map((a) => (
          <li
            key={a.id}
            className={`rounded-lg border border-zinc-300 p-3 space-y-2 dark:border-zinc-700 sm:rounded-none sm:border-0 sm:p-0 sm:py-3 sm:space-y-0 sm:grid sm:grid-cols-[1fr_120px_auto_auto] sm:gap-2 sm:items-center ${
              a.archivedAt ? 'opacity-60' : ''
            }`}
          >
            <Input
              defaultValue={a.name}
              onBlur={(e) => {
                if (e.target.value !== a.name) {
                  renameAsset(a.id, e.target.value);
                }
              }}
            />
            <Input
              defaultValue={a.size.toString()}
              onBlur={(e) => {
                const n = Number(e.target.value);

                if (Number.isFinite(n) && n > 0 && n !== a.size) {
                  resizeAsset(a.id, n);
                }
              }}
            />
            {/* Wrap the two action buttons so they sit side-by-side on mobile
                instead of each taking a full row; `sm:contents` lets each
                button become its own grid cell on desktop. */}
            <div className="flex items-center gap-2 sm:contents">
              {a.archivedAt ? (
                // Archived assets are read-only — ownership edits are blocked
                // server-side too (see ReplaceAssetOwnersUseCase archived guard).
                <span className="hidden sm:block" />
              ) : (
                <Button plain onClick={() => setEditing(a.id)}>
                  {t('assets.editOwners')}
                </Button>
              )}
              <Button
                color={a.archivedAt ? 'zinc' : 'red'}
                onClick={() => toggleArchive(a.id, a.archivedAt !== null)}
              >
                {a.archivedAt ? t('unarchive.button') : t('archive.button')}
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {editing && (
        <EditOwnersModal
          organizationId={organizationId}
          assetId={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function toCamel(v: string): string {
  const [head, ...rest] = v.toLowerCase().split('_');

  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
