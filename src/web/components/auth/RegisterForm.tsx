'use client';

import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import {
  Field,
  Label,
  FieldGroup,
} from '@/src/web/components/catalyst/fieldset';
import {
  Checkbox,
  CheckboxField,
} from '@/src/web/components/catalyst/checkbox';
import { PhoneInput } from '@/web/components/phone';
import { Text, TextLink } from '@/src/web/components/catalyst/text';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { PasswordStrengthMeter } from './PasswordStrengthMeter';
import { TurnstileWidget } from './TurnstileWidget';
import { registerAction } from '@/web/actions/auth';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/16/solid';
import { Locale } from '@/src/i18n/locales';
import {
  NAME_REGEX,
  NAME_MIN_LENGTH,
  NAME_MAX_LENGTH,
  PASSWORD_MIN_LENGTH,
  passwordMatchesPersonalInfo,
} from '@/domain/user/User';

type Props = {
  locale: Locale;
};

export function RegisterForm({ locale }: Props) {
  const t = useTranslations('auth');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // Form field values
  const [formValues, setFormValues] = useState({
    firstName: '',
    lastName: '',
    middleName: '',
    phoneNumber: '',
    password: '',
    confirmPassword: '',
    consentGiven: false,
  });

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

    // Re-validate password against personal info when name/phone changes
    if (
      ['firstName', 'lastName', 'middleName', 'phoneNumber'].includes(name) &&
      formValues.password
    ) {
      const updatedInfo = {
        firstName: name === 'firstName' ? value : formValues.firstName,
        lastName: name === 'lastName' ? value : formValues.lastName,
        middleName: name === 'middleName' ? value : formValues.middleName,
        phoneNumber: name === 'phoneNumber' ? value : formValues.phoneNumber,
      };

      if (passwordMatchesPersonalInfo(formValues.password, updatedInfo)) {
        setFieldErrors((prev) => ({
          ...prev,
          password: [t('register.errors.passwordMatchesPersonalInfo')],
        }));
      } else if (fieldErrors.password) {
        setFieldErrors((prev) => {
          const newErrors = { ...prev };
          delete newErrors.password;

          return newErrors;
        });
      }
    }

    // Re-validate confirmPassword mismatch when password changes
    if (
      name === 'password' &&
      formValues.confirmPassword &&
      value !== formValues.confirmPassword
    ) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: [t('register.errors.passwordMismatch')],
      }));
    } else if (
      name === 'password' &&
      value === formValues.confirmPassword &&
      fieldErrors.confirmPassword
    ) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.confirmPassword;

        return newErrors;
      });
    }

    // Clear general error if user is fixing issues
    if (error) {
      setError(null);
    }
  }

  const nameParams = { minLength: NAME_MIN_LENGTH, maxLength: NAME_MAX_LENGTH };

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const { name, value } = e.target;

    if (name === 'firstName' && value && !isNameValid(value)) {
      setFieldErrors((prev) => ({
        ...prev,
        firstName: [t('register.errors.firstNameInvalid', nameParams)],
      }));
    }

    if (name === 'lastName' && value && !isNameValid(value)) {
      setFieldErrors((prev) => ({
        ...prev,
        lastName: [t('register.errors.lastNameInvalid', nameParams)],
      }));
    }

    if (name === 'middleName' && value && !isNameValid(value)) {
      setFieldErrors((prev) => ({
        ...prev,
        middleName: [t('register.errors.middleNameInvalid', nameParams)],
      }));
    }

    if (name === 'password' && value && value.length < PASSWORD_MIN_LENGTH) {
      setFieldErrors((prev) => ({
        ...prev,
        password: [
          t('register.errors.passwordTooShort', {
            minLength: PASSWORD_MIN_LENGTH,
          }),
        ],
      }));
    } else if (
      name === 'password' &&
      value &&
      passwordMatchesPersonalInfo(value, {
        firstName: formValues.firstName,
        lastName: formValues.lastName,
        middleName: formValues.middleName || undefined,
        phoneNumber: formValues.phoneNumber,
      })
    ) {
      setFieldErrors((prev) => ({
        ...prev,
        password: [t('register.errors.passwordMatchesPersonalInfo')],
      }));
    }

    if (
      name === 'confirmPassword' &&
      value &&
      formValues.password &&
      value !== formValues.password
    ) {
      setFieldErrors((prev) => ({
        ...prev,
        confirmPassword: [t('register.errors.passwordMismatch')],
      }));
    }
  }

  function isNameValid(name: string): boolean {
    return name.length <= NAME_MAX_LENGTH && NAME_REGEX.test(name);
  }

  const isFormValid =
    isNameValid(formValues.firstName) &&
    isNameValid(formValues.lastName) &&
    (!formValues.middleName || isNameValid(formValues.middleName)) &&
    !!formValues.phoneNumber &&
    formValues.password.length >= PASSWORD_MIN_LENGTH &&
    !passwordMatchesPersonalInfo(formValues.password, {
      firstName: formValues.firstName,
      lastName: formValues.lastName,
      middleName: formValues.middleName || undefined,
      phoneNumber: formValues.phoneNumber,
    }) &&
    formValues.password === formValues.confirmPassword &&
    formValues.consentGiven;

  function handleSubmit() {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const formData = new FormData();
      formData.set('firstName', formValues.firstName);
      formData.set('lastName', formValues.lastName);
      formData.set('middleName', formValues.middleName);
      formData.set('phoneNumber', formValues.phoneNumber);
      formData.set('password', formValues.password);
      formData.set('confirmPassword', formValues.confirmPassword);
      formData.set('language', locale);
      formData.set('consentGiven', String(formValues.consentGiven));

      const result = await registerAction(formData);

      if (!result.success) {
        setError(result.error);

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }

        formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      } else {
        // Store OTP data for confirm-phone page
        if (typeof window !== 'undefined') {
          sessionStorage.setItem(
            'confirmPhoneData',
            JSON.stringify({
              otpId: result.data.otpId,
              backdoorCode: result.data.backdoorCode,
              expiresInSeconds: result.data.expiresInSeconds,
            })
          );
        }

        router.push('/confirm-phone');
      }
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit();
      }}
      className="w-full max-w-md space-y-6"
    >
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">
          {t('register.title')}
        </h1>
        <Text>{t('register.subtitle')}</Text>
      </div>

      {error && <AlertBanner color="red">{error}</AlertBanner>}

      <FieldGroup>
        <Field>
          <Label>{t('register.lastName')}</Label>
          <Input
            name="lastName"
            type="text"
            autoComplete="family-name"
            value={formValues.lastName}
            onChange={handleInputChange}
            onBlur={handleBlur}
            required
            disabled={isPending}
            invalid={!!fieldErrors.lastName}
          />
          {fieldErrors.lastName && (
            <Text className="text-sm text-red-600">
              {fieldErrors.lastName[0]}
            </Text>
          )}
        </Field>

        <Field>
          <Label>{t('register.firstName')}</Label>
          <Input
            name="firstName"
            type="text"
            autoComplete="given-name"
            value={formValues.firstName}
            onChange={handleInputChange}
            onBlur={handleBlur}
            required
            disabled={isPending}
            invalid={!!fieldErrors.firstName}
          />
          {fieldErrors.firstName && (
            <Text className="text-sm text-red-600">
              {fieldErrors.firstName[0]}
            </Text>
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
            onBlur={handleBlur}
            disabled={isPending}
            invalid={!!fieldErrors.middleName}
          />
          {fieldErrors.middleName && (
            <Text className="text-sm text-red-600">
              {fieldErrors.middleName[0]}
            </Text>
          )}
          <Text className="text-sm text-zinc-500">
            {t('register.optional')}
          </Text>
        </Field>

        <Field>
          <Label>{t('register.phoneNumber')}</Label>
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
          <Label>{t('register.password')}</Label>
          <div className="relative">
            <Input
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formValues.password}
              onChange={handleInputChange}
              onBlur={handleBlur}
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
          <PasswordStrengthMeter password={formValues.password} />
        </Field>

        <Field>
          <Label>{t('register.confirmPassword')}</Label>
          <div className="relative">
            <Input
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
              autoComplete="new-password"
              value={formValues.confirmPassword}
              onChange={handleInputChange}
              onBlur={handleBlur}
              required
              disabled={isPending}
              invalid={!!fieldErrors.confirmPassword}
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 sm:right-2.5 sm:top-2.5"
              aria-label={
                showConfirmPassword ? 'Hide password' : 'Show password'
              }
              disabled={isPending}
            >
              {showConfirmPassword ? (
                <EyeSlashIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              ) : (
                <EyeIcon className="h-5 w-5 sm:h-4 sm:w-4" />
              )}
            </button>
          </div>
          {fieldErrors.confirmPassword && (
            <Text className="text-sm text-red-600">
              {fieldErrors.confirmPassword[0]}
            </Text>
          )}
        </Field>
        <CheckboxField>
          <Checkbox
            color="green"
            checked={formValues.consentGiven}
            onChange={(checked) => {
              setFormValues((prev) => ({ ...prev, consentGiven: checked }));

              if (error) {
                setError(null);
              }
            }}
            disabled={isPending}
          />
          <Label className="text-sm font-normal">
            {t.rich('register.consentLabel', {
              privacyPolicy: (chunks) => (
                <TextLink href="/privacy" target="_blank">
                  {chunks}
                </TextLink>
              ),
            })}
          </Label>
        </CheckboxField>
      </FieldGroup>

      <TurnstileWidget
        onSuccess={(token) => setCaptchaToken(token)}
        onError={() => setCaptchaToken(null)}
        onExpire={() => setCaptchaToken(null)}
      />

      <Button
        type="submit"
        color="brand-green"
        className="w-full"
        disabled={isPending || !captchaToken || !isFormValid}
      >
        {isPending ? t('register.registering') : t('register.submit')}
      </Button>

      <Text className="text-center text-sm">
        {t('register.haveAccount')}{' '}
        <Button
          plain
          href="/login"
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          {t('register.signIn')}
        </Button>
      </Text>
    </form>
  );
}
