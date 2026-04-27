'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import { ErrorBanner } from '@/src/web/components/shared/ErrorBanner';
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogTitle,
} from '@/src/web/components/catalyst/dialog';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { createPropertyAction } from '@/src/web/actions/organization/property';
import { PropertyEditorInline } from './PropertyEditorInline';
import { AssetsTable } from './AssetsTable';

export interface ClientProperty {
  id: string;
  name: string;
  address: string | null;
  sizeUnit: string;
  archivedAt: string | null;
}

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

export function ManagePropertiesClient({
  organizationId,
  initialProperties,
}: {
  organizationId: string;
  initialProperties: ClientProperty[];
}) {
  const t = useTranslations('propertyAdmin');
  const tUnit = useTranslations('propertyAdmin.sizeUnit');
  const [properties, setProperties] = useState(initialProperties);
  const nonArchived = properties.filter((p) => p.archivedAt === null);
  const [selectedId, setSelectedId] = useState<string | null>(
    nonArchived[0]?.id ?? null
  );
  const [showCreate, setShowCreate] = useState(nonArchived.length === 0);
  const [form, setForm] = useState({
    name: '',
    address: '',
    sizeUnit: 'SQUARE_METERS',
  });
  const [err, setErr] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function refreshSelected(id: string | null) {
    setSelectedId(id);
  }

  async function submitCreate() {
    setErr(null);
    startTransition(async () => {
      const r = await createPropertyAction({
        organizationId,
        name: form.name,
        address: form.address.trim() === '' ? null : form.address,
        sizeUnit: form.sizeUnit,
      });

      if (!r.success) {
        setErr(r.error);

        return;
      }

      // Reload page to refresh server-rendered list.
      window.location.reload();
    });
  }

  if (nonArchived.length === 0) {
    return (
      <div className="space-y-4">
        <Text>{t('empty.cta')}</Text>
        <Button onClick={() => setShowCreate(true)}>{t('empty.create')}</Button>
        {showCreate && (
          <Dialog open onClose={() => setShowCreate(false)}>
            <DialogTitle>{t('create.title')}</DialogTitle>
            <DialogBody>
              <div className="space-y-3">
                <Input
                  placeholder={t('fields.name')}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <Input
                  placeholder={t('fields.address')}
                  value={form.address}
                  onChange={(e) =>
                    setForm({ ...form, address: e.target.value })
                  }
                />
                <Select
                  value={form.sizeUnit}
                  onChange={(e) =>
                    setForm({ ...form, sizeUnit: e.target.value })
                  }
                >
                  {SIZE_UNITS.map((u) => (
                    <option key={u} value={u}>
                      {tUnit(toCamel(u))}
                    </option>
                  ))}
                </Select>
                <ErrorBanner message={err} />
              </div>
            </DialogBody>
            <DialogActions>
              <Button plain onClick={() => setShowCreate(false)}>
                {t('cancel')}
              </Button>
              <Button onClick={submitCreate} disabled={pending}>
                {t('save')}
              </Button>
            </DialogActions>
          </Dialog>
        )}
      </div>
    );
  }

  const useTabs = nonArchived.length >= 2 && nonArchived.length <= 5;
  const selected =
    nonArchived.find((p) => p.id === selectedId) ?? nonArchived[0];

  return (
    <div className="space-y-6">
      {nonArchived.length >= 2 && (
        <div className="flex flex-wrap items-center gap-2">
          {useTabs ? (
            nonArchived.map((p) => (
              <Button
                key={p.id}
                color={p.id === selected.id ? 'brand-green' : 'zinc'}
                onClick={() => refreshSelected(p.id)}
              >
                {p.name}
              </Button>
            ))
          ) : (
            <Select
              value={selected.id}
              onChange={(e) => refreshSelected(e.target.value)}
            >
              {nonArchived.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          )}
          <Button plain onClick={() => setShowCreate(true)}>
            {t('addProperty')}
          </Button>
        </div>
      )}

      {nonArchived.length === 1 && (
        <div>
          <Button plain onClick={() => setShowCreate(true)}>
            {t('addProperty')}
          </Button>
        </div>
      )}

      <PropertyEditorInline property={selected} />
      <AssetsTable
        organizationId={organizationId}
        propertyId={selected.id}
        sizeUnit={selected.sizeUnit}
      />

      {showCreate && (
        <Dialog open onClose={() => setShowCreate(false)}>
          <DialogTitle>{t('create.title')}</DialogTitle>
          <DialogBody>
            <div className="space-y-3">
              <Input
                placeholder={t('fields.name')}
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
              <ErrorBanner message={err} />
            </div>
          </DialogBody>
          <DialogActions>
            <Button plain onClick={() => setShowCreate(false)}>
              {t('cancel')}
            </Button>
            <Button onClick={submitCreate} disabled={pending}>
              {t('save')}
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </div>
  );
}

function toCamel(v: string): string {
  const [head, ...rest] = v.toLowerCase().split('_');

  return head + rest.map((w) => w[0].toUpperCase() + w.slice(1)).join('');
}
