'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Field, Label, FieldGroup } from '@/app/components/catalyst/fieldset';
import { Text } from '@/app/components/catalyst/text';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { loginAction } from '@/web/actions/auth';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  // Form field values
  const [formValues, setFormValues] = useState({
    phoneNumber: '',
    password: '',
  });

  const registered = searchParams.get('registered') === 'true';
  const redirect = searchParams.get('redirect');

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
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

    // Clear general error if user is fixing issues
    if (error) {
      setError(null);
    }
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const result = await loginAction(formData);

      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        // Login successful, redirect to home or specified redirect
        router.push(redirect || '/home');
      }
    });
  }

  return (
    <form action={handleSubmit} className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('login.title')}
        </h1>
        <Text>{t('login.subtitle')}</Text>
      </div>

      {registered && (
        <AlertBanner color="green">
          {t('login.registrationSuccess')}
        </AlertBanner>
      )}

      {error && <AlertBanner color="red">{error}</AlertBanner>}

      <FieldGroup>
        <Field>
          <Label>{t('login.phoneNumber')}</Label>
          <Input
            name="phoneNumber"
            type="tel"
            autoComplete="tel"
            placeholder="+79161234567"
            value={formValues.phoneNumber}
            onChange={handleInputChange}
            required
            disabled={isPending}
            invalid={!!fieldErrors.phoneNumber}
          />
          {fieldErrors.phoneNumber && (
            <Text className="text-sm text-red-600">
              {fieldErrors.phoneNumber[0]}
            </Text>
          )}
        </Field>

        <Field>
          <Label>{t('login.password')}</Label>
          <Input
            name="password"
            type="password"
            autoComplete="current-password"
            value={formValues.password}
            onChange={handleInputChange}
            required
            disabled={isPending}
            invalid={!!fieldErrors.password}
          />
          {fieldErrors.password && (
            <Text className="text-sm text-red-600">
              {fieldErrors.password[0]}
            </Text>
          )}
        </Field>
      </FieldGroup>

      <Button
        type="submit"
        color="blue"
        className="w-full"
        disabled={isPending}
      >
        {isPending ? t('login.signingIn') : t('login.submit')}
      </Button>

      <Text className="text-center text-sm">
        {t('login.noAccount')}{' '}
        <Link
          href="/register"
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          {t('login.signUp')}
        </Link>
      </Text>
    </form>
  );
}
