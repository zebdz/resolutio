'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { Field, Label, FieldGroup } from '@/app/components/catalyst/fieldset';
import { Select } from '@/app/components/catalyst/select';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { updateProfileAction } from '@/web/actions/user';
import { Locale } from '@/src/i18n/locales';

type Props = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    phoneNumber: string;
    language: string;
    createdAt: Date;
  };
};

export function AccountForm({ user }: Props) {
  const t = useTranslations('account');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Form field values
  const [formValues, setFormValues] = useState({
    language: user.language,
  });

  function handleInputChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setFormValues((prev) => ({ ...prev, [name]: value }));

    // Clear field-specific error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];

        return newErrors;
      });
    }

    // Clear messages if user is making changes
    if (error) {
      setError(null);
    }

    if (success) {
      setSuccess(null);
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await updateProfileAction(formData);

      if (!result.success) {
        setError(result.error);

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        setSuccess(t('updateSuccess'));

        // Redirect to the new language locale if changed
        if (formValues.language !== user.language) {
          // Use setTimeout to show success message briefly before redirect
          setTimeout(() => {
            router.push(`/account`, { locale: formValues.language as Locale });
          }, 500);
        }
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {error && <AlertBanner color="red">{error}</AlertBanner>}
      {success && <AlertBanner color="green">{success}</AlertBanner>}

      <FieldGroup>
        <Field>
          <Label>{t('language')}</Label>
          <Select
            name="language"
            value={formValues.language}
            onChange={handleInputChange}
            disabled={isPending}
            invalid={!!fieldErrors.language}
          >
            <option value="en">{t('languageEn')}</option>
            <option value="ru">{t('languageRu')}</option>
          </Select>
          {fieldErrors.language && (
            <p className="text-sm text-red-600">{fieldErrors.language[0]}</p>
          )}
        </Field>
      </FieldGroup>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('saving') : t('save')}
        </Button>
      </div>
    </form>
  );
}
