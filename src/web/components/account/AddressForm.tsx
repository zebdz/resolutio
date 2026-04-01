'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Field,
  Label,
  FieldGroup,
} from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { updateProfileAction } from '@/src/web/actions/user/user';
import { AddressSearch, type AddressFields } from './AddressSearch';

type AddressData = {
  country: string;
  region?: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode?: string;
};

type Props = {
  address?: AddressData | null;
  locale: string;
};

export function AddressForm({ address, locale }: Props) {
  const t = useTranslations('account');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showManualAddress, setShowManualAddress] = useState(!!address);
  const [values, setValues] = useState<AddressFields>({
    country: address?.country || '',
    region: address?.region || '',
    city: address?.city || '',
    street: address?.street || '',
    building: address?.building || '',
    apartment: address?.apartment || '',
    postalCode: address?.postalCode || '',
  });

  const hasAddress =
    values.country.trim() !== '' ||
    values.city.trim() !== '' ||
    values.street.trim() !== '';

  const changed =
    values.country !== (address?.country || '') ||
    values.region !== (address?.region || '') ||
    values.city !== (address?.city || '') ||
    values.street !== (address?.street || '') ||
    values.building !== (address?.building || '') ||
    values.apartment !== (address?.apartment || '') ||
    values.postalCode !== (address?.postalCode || '');

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setValues((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const next = { ...prev };
        delete next[name];

        return next;
      });
    }

    if (error) {
      setError(null);
    }

    if (success) {
      setSuccess(null);
    }
  }

  function handleNominatimSelect(fields: Partial<AddressFields>) {
    setValues((prev) => ({ ...prev, ...fields }));
    setShowManualAddress(true);

    if (error) {
      setError(null);
    }

    if (success) {
      setSuccess(null);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const formData = new FormData();
    formData.set('addressAction', 'save');
    formData.set('addressCountry', values.country);
    formData.set('addressRegion', values.region);
    formData.set('addressCity', values.city);
    formData.set('addressStreet', values.street);
    formData.set('addressBuilding', values.building);
    formData.set('addressApartment', values.apartment);
    formData.set('addressPostalCode', values.postalCode);

    startTransition(async () => {
      const result = await updateProfileAction(formData);

      if (!result.success) {
        setError(result.error);

        if (result.fieldErrors) {
          const mapped: Record<string, string[]> = {};

          for (const [key, errors] of Object.entries(result.fieldErrors)) {
            const field = key.startsWith('address.')
              ? key.replace('address.', '')
              : key;
            mapped[field] = errors;
          }

          setFieldErrors(mapped);
        }
      } else {
        setSuccess(t('addressSuccess'));
      }
    });
  }

  async function handleClear() {
    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.set('addressAction', 'clear');

    startTransition(async () => {
      const result = await updateProfileAction(formData);

      if (!result.success) {
        setError(result.error);
      } else {
        setValues({
          country: '',
          region: '',
          city: '',
          street: '',
          building: '',
          apartment: '',
          postalCode: '',
        });
        setShowManualAddress(false);
        setSuccess(t('addressSuccess'));
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {error && <AlertBanner color="red">{error}</AlertBanner>}
      {success && <AlertBanner color="green">{success}</AlertBanner>}

      <FieldGroup>
        <Field>
          <Label>{t('addressSearchPlaceholder')}</Label>
          <AddressSearch
            locale={locale}
            onSelect={handleNominatimSelect}
            disabled={isPending}
          />
          {!showManualAddress && (
            <button
              type="button"
              className="mt-2 cursor-pointer text-sm text-zinc-500 underline hover:text-zinc-700 dark:hover:text-zinc-300"
              onClick={() => setShowManualAddress(true)}
            >
              {t('addressFillManually')}
            </button>
          )}
        </Field>

        {showManualAddress && (
          <>
            <Field>
              <Label>{t('addressCountry')}</Label>
              <Input
                name="country"
                value={values.country}
                onChange={handleFieldChange}
                disabled={isPending}
                invalid={!!fieldErrors.country}
              />
              {fieldErrors.country && (
                <p className="text-sm text-red-600">{fieldErrors.country[0]}</p>
              )}
            </Field>
            <Field>
              <Label>{t('addressRegion')}</Label>
              <Input
                name="region"
                value={values.region}
                onChange={handleFieldChange}
                disabled={isPending}
              />
            </Field>
            <Field>
              <Label>{t('addressCity')}</Label>
              <Input
                name="city"
                value={values.city}
                onChange={handleFieldChange}
                disabled={isPending}
                invalid={!!fieldErrors.city}
              />
              {fieldErrors.city && (
                <p className="text-sm text-red-600">{fieldErrors.city[0]}</p>
              )}
            </Field>
            <Field>
              <Label>{t('addressStreet')}</Label>
              <Input
                name="street"
                value={values.street}
                onChange={handleFieldChange}
                disabled={isPending}
                invalid={!!fieldErrors.street}
              />
              {fieldErrors.street && (
                <p className="text-sm text-red-600">{fieldErrors.street[0]}</p>
              )}
            </Field>
            <Field>
              <Label>{t('addressBuilding')}</Label>
              <Input
                name="building"
                value={values.building}
                onChange={handleFieldChange}
                disabled={isPending}
                invalid={!!fieldErrors.building}
              />
              {fieldErrors.building && (
                <p className="text-sm text-red-600">
                  {fieldErrors.building[0]}
                </p>
              )}
            </Field>
            <Field>
              <Label>{t('addressApartment')}</Label>
              <Input
                name="apartment"
                value={values.apartment}
                onChange={handleFieldChange}
                disabled={isPending}
              />
            </Field>
            <Field>
              <Label>{t('addressPostalCode')}</Label>
              <Input
                name="postalCode"
                value={values.postalCode}
                onChange={handleFieldChange}
                disabled={isPending}
              />
            </Field>
          </>
        )}
      </FieldGroup>

      <div className="flex justify-end gap-3">
        {address && (
          <Button
            type="button"
            color="red"
            onClick={handleClear}
            disabled={isPending}
          >
            {t('addressClear')}
          </Button>
        )}
        <Button type="submit" disabled={isPending || !changed || !hasAddress}>
          {isPending ? t('addressSaving') : t('addressSave')}
        </Button>
      </div>
    </form>
  );
}
