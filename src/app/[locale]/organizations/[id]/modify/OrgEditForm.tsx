'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import { Heading } from '@/src/web/components/catalyst/heading';
import {
  Field,
  Label,
  FieldGroup,
  Description,
} from '@/src/web/components/catalyst/fieldset';
import { SwitchField, Switch } from '@/src/web/components/catalyst/switch';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { updateOrganizationAction } from '@/src/web/actions/organization/organization';

type Props = {
  organizationId: string;
  currentName: string;
  currentDescription: string;
  isRootOrg: boolean;
  currentAllowMultiTreeMembership: boolean;
  rootOrgMultiMembershipInfo?: {
    allowed: boolean;
    rootOrgName: string;
  };
};

export function OrgEditForm({
  organizationId,
  currentName,
  currentDescription,
  isRootOrg,
  currentAllowMultiTreeMembership,
  rootOrgMultiMembershipInfo,
}: Props) {
  const t = useTranslations('organization.modify');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >();
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [allowMultiTreeMembership, setAllowMultiTreeMembership] = useState(
    currentAllowMultiTreeMembership
  );

  async function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors(undefined);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateOrganizationAction(formData);

      if (!result.success) {
        setError(result.error);
        setFieldErrors(result.fieldErrors);
      } else {
        setSuccess(t('updateSuccess'));
        router.refresh();
      }
    });
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <Heading level={2} className="mb-4">
        {t('editSection')}
      </Heading>

      <form action={handleSubmit} className="space-y-6">
        <input type="hidden" name="organizationId" value={organizationId} />

        {error && !fieldErrors && (
          <AlertBanner color="red">{error}</AlertBanner>
        )}
        {success && <AlertBanner color="green">{success}</AlertBanner>}

        <FieldGroup>
          <Field>
            <Label>{t('nameLabel')}</Label>
            <Input
              name="name"
              value={name}
              invalid={!!fieldErrors?.name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
                setFieldErrors(undefined);
                setSuccess(null);
              }}
              placeholder={t('namePlaceholder')}
              disabled={isPending}
            />
            {fieldErrors?.name && (
              <p className="text-sm text-red-600">{fieldErrors.name[0]}</p>
            )}
          </Field>

          <Field>
            <Label>{t('descriptionLabel')}</Label>
            <Textarea
              name="description"
              value={description}
              invalid={!!fieldErrors?.description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
                setFieldErrors(undefined);
                setSuccess(null);
              }}
              placeholder={t('descriptionPlaceholder')}
              rows={4}
              disabled={isPending}
            />
            {fieldErrors?.description && (
              <p className="text-sm text-red-600">
                {fieldErrors.description[0]}
              </p>
            )}
          </Field>

          {isRootOrg ? (
            <SwitchField>
              <Label>{t('allowMultiTreeMembershipLabel')}</Label>
              <Description>
                {t('allowMultiTreeMembershipDescription')}
              </Description>
              <Switch
                checked={allowMultiTreeMembership}
                onChange={(val: boolean) => {
                  setAllowMultiTreeMembership(val);
                  setError(null);
                  setFieldErrors(undefined);
                  setSuccess(null);
                }}
                color="brand-green"
                disabled={isPending}
              />
            </SwitchField>
          ) : rootOrgMultiMembershipInfo ? (
            <div className="text-sm text-zinc-600 dark:text-zinc-400">
              {t('allowMultiTreeMembershipInherited', {
                status: rootOrgMultiMembershipInfo.allowed
                  ? t('allowed')
                  : t('disallowed'),
                rootOrgName: rootOrgMultiMembershipInfo.rootOrgName,
              })}
            </div>
          ) : null}
        </FieldGroup>

        {isRootOrg && (
          <input
            type="hidden"
            name="allowMultiTreeMembership"
            value={allowMultiTreeMembership ? 'true' : 'false'}
          />
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
