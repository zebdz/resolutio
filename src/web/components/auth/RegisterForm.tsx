'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { Input, InputGroup } from '@/app/components/catalyst/input';
import { Field, Label, FieldGroup } from '@/app/components/catalyst/fieldset';
import { Text } from '@/app/components/catalyst/text';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { registerAction, type ActionResult } from '@/web/actions/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/16/solid';

export function RegisterForm() {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  
  // Form field values
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
  });

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target;
    setFormValues(prev => ({ ...prev, [name]: value }));
    
    // Clear field-specific error when user starts typing
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
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
      const result = await registerAction(formData);

      if (!result.success) {
        setError(result.error);
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        // Registration successful, redirect to login
        router.push('/login?registered=true');
      }
    });
  }

  return (
    <form action={handleSubmit} className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('register.title')}</h1>
        <Text>{t('register.subtitle')}</Text>
      </div>

      {error && (
        <AlertBanner color="red">
          {error}
        </AlertBanner>
      )}

      <FieldGroup>
        <Field>
          <Label>{t('register.firstName')}</Label>
          <Input
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={formValues.firstName}
            onChange={handleInputChange}
            required
            disabled={isPending}
            invalid={!!fieldErrors.firstName}
          />
          {fieldErrors.firstName && (
            <Text className="text-sm text-red-600">{fieldErrors.firstName[0]}</Text>
          )}
        </Field>

        <Field>
          <Label>{t('register.lastName')}</Label>
          <Input
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={formValues.lastName}
            onChange={handleInputChange}
            required
            disabled={isPending}
            invalid={!!fieldErrors.lastName}
          />
          {fieldErrors.lastName && (
            <Text className="text-sm text-red-600">{fieldErrors.lastName[0]}</Text>
          )}
        </Field>

        <Field>
          <Label>{t('register.middleName')}</Label>
          <Input
            name="middleName"
            type="text"
            autoComplete="additional-name"
            value={formValues.middleName}
            onChange={handleInputChange}
            disabled={isPending}
            invalid={!!fieldErrors.middleName}
          />
          {fieldErrors.middleName && (
            <Text className="text-sm text-red-600">{fieldErrors.middleName[0]}</Text>
          )}
          <Text className="text-sm text-zinc-500">{t('register.optional')}</Text>
        </Field>

        <Field>
          <Label>{t('register.phoneNumber')}</Label>
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
            <Text className="text-sm text-red-600">{fieldErrors.phoneNumber[0]}</Text>
          )}
          <Text className="text-sm text-zinc-500">{t('register.phoneHint')}</Text>
        </Field>

        <Field>
          <Label>{t('register.password')}</Label>
          <InputGroup>
            <Input
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="new-password"
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
              aria-label={showPassword ? "Hide password" : "Show password"}
              disabled={isPending}
            >
              {showPassword ? (
                <EyeSlashIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              ) : (
                <EyeIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              )}
            </button>
          </InputGroup>
          {fieldErrors.password && (
            <Text className="text-sm text-red-600">{fieldErrors.password[0]}</Text>
          )}
        </Field>

        <Field>
          <Label>{t('register.confirmPassword')}</Label>
          <InputGroup>
            <Input
              name="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              autoComplete="new-password"
              value={formValues.confirmPassword}
              onChange={handleInputChange}
              required
              disabled={isPending}
              invalid={!!fieldErrors.confirmPassword}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 sm:right-2.5 sm:top-2.5"
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}
              disabled={isPending}
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              ) : (
                <EyeIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              )}
            </button>
          </InputGroup>
          {fieldErrors.confirmPassword && (
            <Text className="text-sm text-red-600">{fieldErrors.confirmPassword[0]}</Text>
          )}
        </Field>
      </FieldGroup>

      <Button type="submit" color="blue" className="w-full" disabled={isPending}>
        {isPending ? t('register.registering') : t('register.submit')}
      </Button>

      <Text className="text-center text-sm">
        {t('register.haveAccount')}{' '}
        <Button plain href="/login" className="font-semibold text-blue-600 hover:text-blue-500">
          {t('register.signIn')}
        </Button>
      </Text>
    </form>
  );
}
