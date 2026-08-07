'use client';

import { useTranslations } from 'next-intl';
import { useState, useRef, useTransition } from 'react';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Field,
  Label,
  FieldGroup,
  Description,
} from '@/src/web/components/catalyst/fieldset';
import { Switch, SwitchField } from '@/src/web/components/catalyst/switch';
import { Input } from '@/src/web/components/catalyst/input';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { updateProfileAction } from '@/src/web/actions/user/user';
import { AddressSearch, type AddressFields } from './AddressSearch';
import { ApartmentSearch } from './ApartmentSearch';

type AddressData = {
  country: string;
  region?: string;
  city: string;
  street: string;
  building: string;
  apartment?: string;
  postalCode?: string;
  isPrivateHouse: boolean;
  oneLine?: string;
  houseFiasId?: string;
  flatFiasId?: string;
};

type Props = {
  address?: AddressData | null;
};

export function AddressForm({ address }: Props) {
  const t = useTranslations('account');

  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showManualAddress, setShowManualAddress] = useState(!!address);
  const [houseLabel, setHouseLabel] = useState(address?.oneLine || '');
  const [values, setValues] = useState<AddressFields>({
    country: address?.country || '',
    region: address?.region || '',
    city: address?.city || '',
    street: address?.street || '',
    building: address?.building || '',
    apartment: address?.apartment || '',
    postalCode: address?.postalCode || '',
    isPrivateHouse: address?.isPrivateHouse ?? false,
    oneLine: address?.oneLine || '',
    houseFiasId: address?.houseFiasId || '',
    flatFiasId: address?.flatFiasId || '',
  });
  // Whether the user has touched the «Частный дом» switch since the current
  // probe (see handleAddressSelect) started. A ref, not state: flipping it
  // must not trigger a re-render, and the probe's async continuation needs
  // to read its *current* value, not the one captured when the probe began.
  const toggleTouchedRef = useRef(false);

  const hasAddress =
    values.country.trim() !== '' ||
    values.city.trim() !== '' ||
    values.street.trim() !== '';

  const apartmentMissing =
    !values.isPrivateHouse && values.apartment.trim() === '';

  const changed =
    values.country !== (address?.country || '') ||
    values.region !== (address?.region || '') ||
    values.city !== (address?.city || '') ||
    values.street !== (address?.street || '') ||
    values.building !== (address?.building || '') ||
    values.apartment !== (address?.apartment || '') ||
    values.postalCode !== (address?.postalCode || '') ||
    values.isPrivateHouse !== (address?.isPrivateHouse ?? false) ||
    values.oneLine !== (address?.oneLine || '') ||
    values.houseFiasId !== (address?.houseFiasId || '') ||
    values.flatFiasId !== (address?.flatFiasId || '');

  function handleFieldChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setValues((prev) => ({
      ...prev,
      [name]: value,
      // Hand-edited addresses carry no ГАР provenance
      oneLine: '',
      houseFiasId: '',
      flatFiasId: '',
      // No provenance means no probe was possible for whatever the fields
      // now describe — fall back to the safe default (apartment required)
      // rather than leaving a toggle decided by the address before the edit.
      isPrivateHouse: false,
    }));
    setHouseLabel('');

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

  async function handleAddressSelect(fields: AddressFields, label: string) {
    setValues(fields);
    setHouseLabel(label);
    setShowManualAddress(true);
    setError(null);
    setSuccess(null);

    // A flat-level pick is itself proof the building has flats, so no probe is
    // needed — and probing would be actively wrong: the query is built from the
    // house label, and we already know the answer. Toggle stays off (apartment
    // required) and the apartment is already filled from the suggestion.
    if (fields.apartment) {
      return;
    }

    // Probe ГАР for flats. Found → it is demonstrably an apartment block, so
    // apartment stays required. None found → most likely a private house.
    // Nominatim results have no houseFiasId and cannot be probed, so they keep
    // the safe default of "apartment required".
    if (!fields.houseFiasId) {
      return;
    }

    // Identity of the selection this probe was started for. If the user edits
    // a field (which clears houseFiasId, see handleFieldChange) or picks a
    // different house before this resolves, applying the response later would
    // silently stamp a toggle derived from a *different* address onto the
    // current one — re-opening the exact hole this probe exists to close.
    const probedHouseFiasId = fields.houseFiasId;
    // A fresh probe cycle starts "untouched" — see the Switch's onChange,
    // which is the only other place this ref is written.
    toggleTouchedRef.current = false;

    try {
      const res = await fetch('/api/address/flats', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ houseLabel: label, fragment: '' }),
      });

      if (res.ok) {
        const { flats } = (await res.json()) as { flats: unknown[] };
        setValues((prev) =>
          // An explicit user choice always wins over an inferred one: if the
          // user flipped the switch by hand while this was in flight, leave
          // it alone even though houseFiasId still matches.
          prev.houseFiasId === probedHouseFiasId && !toggleTouchedRef.current
            ? { ...prev, isPrivateHouse: flats.length === 0 }
            : prev
        );
      }
    } catch {
      // Leave the safe default in place
    }
  }

  // Mirrors Address.create's checks (country, city, street, building, then
  // apartment-unless-private-house) so the client never sends a submission
  // the domain would reject anyway. Unlike Address.create, which throws on
  // the first failing check, this collects every missing field so the user
  // sees all of them at once instead of one-at-a-time whack-a-mole.
  function validateAddress(): Record<string, string[]> {
    const errors: Record<string, string[]> = {};

    if (values.country.trim() === '') {
      errors.country = [t('addressCountryRequired')];
    }

    if (values.city.trim() === '') {
      errors.city = [t('addressCityRequired')];
    }

    if (values.street.trim() === '') {
      errors.street = [t('addressStreetRequired')];
    }

    if (values.building.trim() === '') {
      errors.building = [t('addressBuildingRequired')];
    }

    if (apartmentMissing) {
      errors.apartment = [t('addressApartmentRequired')];
    }

    return errors;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    const validationErrors = validateAddress();

    if (Object.keys(validationErrors).length > 0) {
      setFieldErrors(validationErrors);

      return;
    }

    const formData = new FormData();
    formData.set('addressAction', 'save');
    formData.set('addressCountry', values.country);
    formData.set('addressRegion', values.region);
    formData.set('addressCity', values.city);
    formData.set('addressStreet', values.street);
    formData.set('addressBuilding', values.building);
    formData.set('addressApartment', values.apartment);
    formData.set('addressPostalCode', values.postalCode);
    formData.set('addressIsPrivateHouse', String(values.isPrivateHouse));
    formData.set('addressOneLine', values.oneLine);
    formData.set('addressHouseFiasId', values.houseFiasId);
    formData.set('addressFlatFiasId', values.flatFiasId);

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
          isPrivateHouse: false,
          oneLine: '',
          houseFiasId: '',
          flatFiasId: '',
        });
        setHouseLabel('');
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
          <AddressSearch onSelect={handleAddressSelect} disabled={isPending} />
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

            <SwitchField>
              <Label>{t('addressPrivateHouse')}</Label>
              <Description>{t('addressPrivateHouseDescription')}</Description>
              <Switch
                color="brand-green"
                checked={values.isPrivateHouse}
                onChange={(checked) => {
                  // Marks this an explicit user choice so a flat probe still
                  // in flight for the current house does not overwrite it —
                  // see the guard in handleAddressSelect.
                  toggleTouchedRef.current = true;
                  setValues((prev) => ({
                    ...prev,
                    isPrivateHouse: checked,
                    // A private house has no flat
                    apartment: checked ? '' : prev.apartment,
                    flatFiasId: checked ? '' : prev.flatFiasId,
                  }));
                  setError(null);
                  setSuccess(null);
                }}
                disabled={isPending}
              />
            </SwitchField>

            {!values.isPrivateHouse && (
              <Field>
                <Label>{t('addressApartment')}</Label>
                <ApartmentSearch
                  value={values.apartment}
                  houseLabel={houseLabel}
                  houseFiasId={values.houseFiasId}
                  disabled={isPending}
                  invalid={apartmentMissing || !!fieldErrors.apartment}
                  onChange={(flat, flatFiasId) => {
                    setValues((prev) => ({
                      ...prev,
                      apartment: flat,
                      flatFiasId,
                    }));
                    setError(null);
                    setSuccess(null);
                  }}
                />
                {apartmentMissing && (
                  <p className="text-sm text-red-600">
                    {t('addressApartmentRequired')}
                  </p>
                )}
                {/* apartmentMissing already covers the "required" case (and
                    validateAddress uses the same message key for it) — only
                    show fieldErrors.apartment here for a different reason,
                    e.g. a server-side profanity rejection, so the same text
                    never renders twice. */}
                {!apartmentMissing && fieldErrors.apartment && (
                  <p className="text-sm text-red-600">
                    {fieldErrors.apartment[0]}
                  </p>
                )}
              </Field>
            )}

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
