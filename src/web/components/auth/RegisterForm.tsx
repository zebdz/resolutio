'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, useEffect, useCallback } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Field, Label, FieldGroup } from '@/app/components/catalyst/fieldset';
import { Checkbox, CheckboxField } from '@/app/components/catalyst/checkbox';
import { PhoneInput } from '@/web/components/phone';
import { Text, TextLink } from '@/app/components/catalyst/text';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { TurnstileWidget } from './TurnstileWidget';
import { OtpInput } from './OtpInput';
import { registerAction } from '@/web/actions/auth';
import { requestOtpAction, verifyOtpAction } from '@/web/actions/otp';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/16/solid';
import { Locale } from '@/src/i18n/locales';

type Props = {
  locale: Locale;
};

type Step = 'form' | 'otp';

export function RegisterForm({ locale }: Props) {
  const t = useTranslations('auth');
  const tOtp = useTranslations('otp');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Step state
  const [step, setStep] = useState<Step>('form');
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);

  // OTP state
  const [otpId, setOtpId] = useState<string | null>(null);
  const [backdoorCode, setBackdoorCode] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);

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

  // Resend countdown timer
  useEffect(() => {
    if (resendCountdown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCountdown]);

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

  const handleRequestOtp = useCallback(() => {
    setError(null);
    setFieldErrors({});

    startTransition(async () => {
      const formData = new FormData();
      formData.set('phoneNumber', formValues.phoneNumber);
      formData.set('captchaToken', captchaToken || '');
      formData.set('locale', locale);

      // Also validate form fields locally before sending OTP
      const localFormData = new FormData();
      localFormData.set('firstName', formValues.firstName);
      localFormData.set('lastName', formValues.lastName);
      localFormData.set('middleName', formValues.middleName);
      localFormData.set('phoneNumber', formValues.phoneNumber);
      localFormData.set('password', formValues.password);
      localFormData.set('confirmPassword', formValues.confirmPassword);
      localFormData.set('language', locale);
      localFormData.set('otpId', 'pending');

      // Client-side basic validation
      if (!formValues.firstName.trim()) {
        setFieldErrors({
          firstName: [t('register.errors.firstNameRequired') || 'Required'],
        });

        return;
      }

      if (!formValues.lastName.trim()) {
        setFieldErrors({
          lastName: [t('register.errors.lastNameRequired') || 'Required'],
        });

        return;
      }

      if (!formValues.phoneNumber) {
        setFieldErrors({ phoneNumber: [t('register.errors.invalidPhone')] });

        return;
      }

      if (formValues.password.length < 8) {
        setFieldErrors({
          password: [
            t('register.errors.passwordTooShort') || 'Min 8 characters',
          ],
        });

        return;
      }

      if (formValues.password !== formValues.confirmPassword) {
        setFieldErrors({
          confirmPassword: [t('register.errors.passwordMismatch')],
        });

        return;
      }

      if (!formValues.consentGiven) {
        setError(t('register.errors.consentNotGiven'));

        return;
      }

      const result = await requestOtpAction(formData);

      if (!result.success) {
        setError(result.error);
      } else {
        setOtpId(result.data.otpId);
        setBackdoorCode(result.data.backdoorCode || null);
        setOtpCode('');
        setStep('otp');
        setResendCountdown(60);
      }
    });
  }, [formValues, captchaToken, locale, t, startTransition]);

  function handleVerifyAndRegister() {
    setError(null);

    startTransition(async () => {
      // First verify OTP
      const verifyData = new FormData();
      verifyData.set('otpId', otpId || '');
      verifyData.set('code', otpCode);

      const verifyResult = await verifyOtpAction(verifyData);

      if (!verifyResult.success) {
        setError(verifyResult.error);

        return;
      }

      // Then register
      const registerData = new FormData();
      registerData.set('firstName', formValues.firstName);
      registerData.set('lastName', formValues.lastName);
      registerData.set('middleName', formValues.middleName);
      registerData.set('phoneNumber', formValues.phoneNumber);
      registerData.set('password', formValues.password);
      registerData.set('confirmPassword', formValues.confirmPassword);
      registerData.set('language', locale);
      registerData.set('otpId', otpId || '');
      registerData.set('consentGiven', String(formValues.consentGiven));

      const registerResult = await registerAction(registerData);

      if (!registerResult.success) {
        setError(registerResult.error);

        if (registerResult.fieldErrors) {
          setFieldErrors(registerResult.fieldErrors);
          setStep('form');
        }
      } else {
        router.push('/login?registered=true');
      }
    });
  }

  function handleResendOtp() {
    if (resendCountdown > 0) {
      return;
    }

    // Reset captcha token to force re-verification would be ideal,
    // but for simplicity we reuse the existing token
    handleRequestOtp();
  }

  function handleBackToForm() {
    setStep('form');
    setOtpCode('');
    setError(null);
  }

  // Mask phone for display: +7916***4567
  const maskedPhone = formValues.phoneNumber
    ? formValues.phoneNumber.replace(
        /^(\+\d{1,4})(\d*)(\d{4})$/,
        (_, prefix, middle, last) =>
          `${prefix}${'*'.repeat(middle.length)}${last}`
      )
    : '';

  if (step === 'otp') {
    return (
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tOtp('title')}
          </h1>
          <Text>{tOtp('subtitle', { phone: maskedPhone })}</Text>
        </div>

        {error && <AlertBanner color="red">{error}</AlertBanner>}

        {/* Backdoor code display */}
        {backdoorCode && (
          <AlertBanner color="blue">
            {tOtp('backdoorHint', { code: backdoorCode })}
          </AlertBanner>
        )}

        <div className="space-y-4">
          <OtpInput
            value={otpCode}
            onChange={(val) => {
              setOtpCode(val);

              if (error) {
                setError(null);
              }
            }}
            disabled={isPending}
            invalid={!!error}
          />

          <Button
            type="button"
            color="brand-green"
            className="w-full"
            disabled={isPending || otpCode.length < 6}
            onClick={handleVerifyAndRegister}
          >
            {isPending ? tOtp('verifying') : tOtp('verify')}
          </Button>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              plain
              onClick={handleBackToForm}
              disabled={isPending}
            >
              {tOtp('back')}
            </Button>

            <Button
              type="button"
              plain
              onClick={handleResendOtp}
              disabled={isPending || resendCountdown > 0}
            >
              {resendCountdown > 0
                ? tOtp('resendIn', { seconds: resendCountdown })
                : tOtp('resend')}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleRequestOtp();
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
            <Text className="text-sm text-red-600">
              {fieldErrors.firstName[0]}
            </Text>
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
            <Text className="text-sm text-red-600">
              {fieldErrors.lastName[0]}
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

        <Field>
          <Label>{t('register.confirmPassword')}</Label>
          <div className="relative">
            <Input
              name="confirmPassword"
              type={showConfirmPassword ? 'text' : 'password'}
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
        disabled={isPending || !captchaToken || !formValues.consentGiven}
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
