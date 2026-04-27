'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import { listOwnershipRowsAction } from '@/src/web/actions/organization/property';
import { OwnershipExportPdfButton } from './OwnershipExportPdfButton';

interface OwnershipRow {
  id: string;
  assetId: string;
  assetName: string;
  propertyId: string;
  propertyName: string;
  userId: string | null;
  userLabel: string | null;
  externalOwnerLabel: string | null;
  share: number;
  effectiveFrom: string;
  effectiveUntil: string | null;
}

export function OwnershipTable({ organizationId }: { organizationId: string }) {
  const t = useTranslations('propertyAdmin.ownership');
  const [rows, setRows] = useState<OwnershipRow[]>([]);
  const [activeOnly, setActiveOnly] = useState(true);
  const [ownerFilter, setOwnerFilter] = useState('');
  const [assetFilter, setAssetFilter] = useState('');

  useEffect(() => {
    async function reload() {
      const r = await listOwnershipRowsAction({
        organizationId,
        activeOnly,
        ownerQuery: ownerFilter || undefined,
        assetQuery: assetFilter || undefined,
      });

      if (r.success) {
        setRows(r.data.rows);
      }
    }

    reload();
  }, [organizationId, activeOnly, ownerFilter, assetFilter]);

  // Group rows by asset so each asset renders as one block with a header row
  // and its ownership history underneath. Groups are sorted by property name
  // then asset name for readability; within a group, rows keep the server's
  // effectiveFrom-desc order (newest first).
  const groups = useMemo(() => {
    const byAsset = new Map<
      string,
      { assetId: string; property: string; asset: string; rows: OwnershipRow[] }
    >();

    for (const r of rows) {
      const existing = byAsset.get(r.assetId);

      if (existing) {
        existing.rows.push(r);
      } else {
        byAsset.set(r.assetId, {
          assetId: r.assetId,
          property: r.propertyName,
          asset: r.assetName,
          rows: [r],
        });
      }
    }

    return Array.from(byAsset.values()).sort((a, b) => {
      const byProp = a.property.localeCompare(b.property);

      return byProp !== 0 ? byProp : a.asset.localeCompare(b.asset);
    });
  }, [rows]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2 items-center">
        <label className="inline-flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={activeOnly}
            onChange={(e) => setActiveOnly(e.target.checked)}
          />
          {t('activeOnly')}
        </label>
        <Input
          placeholder={t('filters.ownerName')}
          value={ownerFilter}
          onChange={(e) => setOwnerFilter(e.target.value)}
        />
        <Input
          placeholder={t('filters.assetName')}
          value={assetFilter}
          onChange={(e) => setAssetFilter(e.target.value)}
        />
        {/* PDF export of the current filtered view. The route is gated to
            org admins + superadmins; this page itself redirects non-admins,
            so anyone seeing the button is already authorized. */}
        <div className="ml-auto">
          <OwnershipExportPdfButton
            organizationId={organizationId}
            activeOnly={activeOnly}
            ownerQuery={ownerFilter}
            assetQuery={assetFilter}
          />
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="text-left border-b border-zinc-200 dark:border-zinc-800">
              <th className="py-2 pr-2">{t('cols.owner')}</th>
              <th className="pr-2">{t('cols.share')}</th>
              <th className="pr-2">{t('cols.from')}</th>
              <th className="pr-2">{t('cols.until')}</th>
            </tr>
          </thead>
          {groups.length === 0 && (
            <tbody>
              <tr>
                <td colSpan={4} className="py-3 text-center">
                  <Text>{t('empty')}</Text>
                </td>
              </tr>
            </tbody>
          )}
          {groups.map((g, idx) => (
            <tbody
              key={g.assetId}
              className="border-b border-zinc-200 dark:border-zinc-800"
            >
              <tr className="bg-zinc-100 dark:bg-zinc-800 border-y-2 border-zinc-300 dark:border-zinc-700">
                {/* Extra top padding on every group except the first creates
                    visual breathing room between asset blocks. */}
                <td
                  colSpan={4}
                  className={`pb-3 pr-2 pl-3 ${idx === 0 ? 'pt-3' : 'pt-7'}`}
                >
                  <span className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                    {g.asset}
                  </span>
                  <span className="ml-2 text-xs uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                    · {g.property}
                  </span>
                </td>
              </tr>
              {g.rows.map((r) => (
                <tr
                  key={r.id}
                  className="border-t border-zinc-100 dark:border-zinc-900"
                >
                  <td className="py-1 pr-2">
                    {r.userLabel ?? r.externalOwnerLabel ?? r.userId}
                  </td>
                  <td className="pr-2">{(r.share * 100).toFixed(2)}%</td>
                  <td className="pr-2">
                    {new Date(r.effectiveFrom).toLocaleDateString()}
                  </td>
                  <td className="pr-2">
                    {r.effectiveUntil
                      ? new Date(r.effectiveUntil).toLocaleDateString()
                      : t('active')}
                  </td>
                </tr>
              ))}
            </tbody>
          ))}
        </table>
      </div>
    </div>
  );
}
