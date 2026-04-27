'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { Button } from '@/src/web/components/catalyst/button';
import { ErrorBanner } from '@/src/web/components/shared/ErrorBanner';
import {
  updatePropertyAction,
  archivePropertyAction,
  unarchivePropertyAction,
} from '@/src/web/actions/organization/property';
import type { ClientProperty } from './ManagePropertiesClient';

const SIZE_UNITS = [
  'SQUARE_METERS',
  'SQUARE_FEET',
  'HECTARES',
  'ACRES',
  'CUBIC_METERS',
  'LINEAR_METERS',
  'UNIT_COUNT',
  'SHARES',
];

export function PropertyEditorInline({
  property,
}: {
  property: ClientProperty;
}) {
  const t = useTranslations('propertyAdmin');
  const tUnit = useTranslations('propertyAdmin.sizeUnit');
  const [form, setForm] = useState({
    name: property.name,
    address: property.address ?? '',
    sizeUnit: property.sizeUnit,
  });
  const [pending, startTransition] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setErr(null);
    startTransition(async () => {
      const r = await updatePropertyAction({
        propertyId: property.id,
        name: form.name,
        address: form.address.trim() === '' ? null : form.address,
        sizeUnit: form.sizeUnit,
      });

      if (!r.success) {
        setErr(r.error);

        return;
      }
    });
  }

  async function archive() {
    if (!window.confirm(t('archive.confirm'))) {
      return;
    }

    startTransition(async () => {
      const r = await archivePropertyAction({ propertyId: property.id });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      window.location.reload();
    });
  }

  async function unarchive() {
    startTransition(async () => {
      const r = await unarchivePropertyAction({ propertyId: property.id });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      window.location.reload();
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900 space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
        />
        <Input
          placeholder={t('fields.address')}
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
        />
        <Select
          value={form.sizeUnit}
          onChange={(e) => setForm({ ...form, sizeUnit: e.target.value })}
        >
          {SIZE_UNITS.map((u) => (
            <option key={u} value={u}>
              {tUnit(toCamel(u))}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={pending}>
          {t('save')}
        </Button>
        {property.archivedAt ? (
          <Button plain onClick={unarchive} disabled={pending}>
            {t('unarchive.button')}
          </Button>
        ) : (
          <Button color="red" onClick={archive} disabled={pending}>
            {t('archive.button')}
          </Button>
        )}
      </div>
      <ErrorBanner message={err} />
    </div>
  );
}

function toCamel(v: string): string {
  const [head, ...rest] = v.toLowerCase().split('_');

  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
