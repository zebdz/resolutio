'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Textarea } from '@/app/components/catalyst/textarea';
import { Heading } from '@/app/components/catalyst/heading';
import { Field, Label, FieldGroup } from '@/app/components/catalyst/fieldset';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { updateOrganizationAction } from '@/web/actions/organization';

type Props = {
  organizationId: string;
  currentName: string;
  currentDescription: string;
};

export function OrgEditForm({
  organizationId,
  currentName,
  currentDescription,
}: Props) {
  const t = useTranslations('organization.modify');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      const result = await updateOrganizationAction(formData);

      if (!result.success) {
        setError(result.error);
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

        {error && <AlertBanner color="red">{error}</AlertBanner>}
        {success && <AlertBanner color="green">{success}</AlertBanner>}

        <FieldGroup>
          <Field>
            <Label>{t('nameLabel')}</Label>
            <Input
              name="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder={t('namePlaceholder')}
              disabled={isPending}
            />
          </Field>

          <Field>
            <Label>{t('descriptionLabel')}</Label>
            <Textarea
              name="description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setError(null);
                setSuccess(null);
              }}
              placeholder={t('descriptionPlaceholder')}
              rows={4}
              disabled={isPending}
            />
          </Field>
        </FieldGroup>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPending}>
            {isPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>
    </div>
  );
}
