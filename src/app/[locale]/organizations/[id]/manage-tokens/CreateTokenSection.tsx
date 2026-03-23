'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import {
  Field,
  Label,
  FieldGroup,
} from '@/src/web/components/catalyst/fieldset';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { Heading } from '@/src/web/components/catalyst/heading';
import { createJoinTokenAction } from '@/web/actions/joinToken';
import { toast } from 'sonner';

export function CreateTokenSection({
  organizationId,
  onCreated,
}: {
  organizationId: string;
  onCreated?: () => void;
}) {
  const t = useTranslations('joinToken.manage');

  const [description, setDescription] = useState('');
  const [maxUses, setMaxUses] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<
    Record<string, string[]> | undefined
  >(undefined);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors(undefined);

    try {
      const formData = new FormData();
      formData.set('organizationId', organizationId);
      formData.set('description', description);

      if (maxUses) {
        formData.set('maxUses', maxUses);
      }

      const result = await createJoinTokenAction(formData);

      if (result.success) {
        toast.success(t('createSuccess'));
        setDescription('');
        setMaxUses('');
        onCreated?.();
      } else {
        setError(result.error);

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <Heading className="mb-4 text-lg font-semibold">
        {t('createTitle')}
      </Heading>

      {error && !fieldErrors && (
        <AlertBanner color="red" className="mb-4">
          {error}
        </AlertBanner>
      )}

      <form onSubmit={handleSubmit}>
        <FieldGroup>
          <Field>
            <Label>{t('description')}</Label>
            <Textarea
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);

                if (fieldErrors?.description) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.description;

                    return next;
                  });
                }
              }}
              placeholder={t('descriptionPlaceholder')}
              rows={2}
              invalid={!!fieldErrors?.description}
            />
            {fieldErrors?.description && (
              <p className="text-sm text-red-600">
                {fieldErrors.description[0]}
              </p>
            )}
          </Field>

          <Field>
            <Label>{t('maxUses')}</Label>
            <Input
              type="number"
              value={maxUses}
              onChange={(e) => {
                setMaxUses(e.target.value);

                if (fieldErrors?.maxUses) {
                  setFieldErrors((prev) => {
                    const next = { ...prev };
                    delete next.maxUses;

                    return next;
                  });
                }
              }}
              placeholder={t('maxUsesPlaceholder')}
              min={1}
              invalid={!!fieldErrors?.maxUses}
            />
            {fieldErrors?.maxUses && (
              <p className="text-sm text-red-600">{fieldErrors.maxUses[0]}</p>
            )}
          </Field>
        </FieldGroup>

        <div className="mt-4">
          <Button type="submit" color="brand-green" disabled={submitting}>
            {submitting ? t('creating') : t('create')}
          </Button>
        </div>
      </form>
    </div>
  );
}
