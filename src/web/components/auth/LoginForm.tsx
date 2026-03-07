'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Field, Label, FieldGroup } from '@/app/components/catalyst/fieldset';
import { PhoneInput } from '@/web/components/phone';
import { Text } from '@/app/components/catalyst/text';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { loginAction } from '@/web/actions/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/16/solid';
import { TurnstileWidget } from '@/web/components/auth/TurnstileWidget';

export function LoginForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

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

    // Override formatted phone with clean E.164 value from React state
    formData.set('phoneNumber', formValues.phoneNumber);

    if (captchaToken) {
      formData.set('captchaToken', captchaToken);
    }

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
          <PhoneInput
            name="phoneNumber"
            value={formValues.phoneNumber}
            onChange={(e164) => {
              setFormValues((prev) => ({ ...prev, phoneNumber: e164 }));

              if (fieldErrors.phoneNumber) {
                setFieldErrors((prev) => {
                  const newErrors = { ...prev };
                  delete newErrors.phoneNumber;

                  return newErrors;
                });
              }

              if (error) {
                setError(null);
              }
            }}
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
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              value={formValues.password}
              onChange={handleInputChange}
              required
              disabled={isPending}
              invalid={!!fieldErrors.password}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 sm:right-2.5 sm:top-2.5"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              disabled={isPending}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              ) : (
                <EyeIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              )}
            </button>
          </div>
          {fieldErrors.password && (
            <Text className="text-sm text-red-600">
              {fieldErrors.password[0]}
            </Text>
          )}
        </Field>
      </FieldGroup>

      <TurnstileWidget
        onSuccess={setCaptchaToken}
        onExpire={() => setCaptchaToken(null)}
        onError={() => setCaptchaToken(null)}
      />

      <Button
        type="submit"
        color="brand-green"
        className="w-full"
        disabled={isPending || !captchaToken}
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
