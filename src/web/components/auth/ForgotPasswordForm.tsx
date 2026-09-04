'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter, Link } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Field,
  Label,
  Description,
  FieldGroup,
} from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { Text } from '@/src/web/components/catalyst/text';
import { Heading } from '@/src/web/components/catalyst/heading';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { TurnstileWidget } from '@/web/components/auth/TurnstileWidget';
import { isCaptchaRequired } from '@/web/components/auth/captchaRequired';
import {
  requestPasswordResetAction,
  resetPasswordWithOtpAction,
} from '@/src/web/actions/auth/passwordReset';

export function ForgotPasswordForm() {
  const t = useTranslations('auth.forgotPassword');
  const router = useRouter();

  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState<'identify' | 'reset'>('identify');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [identifier, setIdentifier] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaResetKey((k) => k + 1);
  }

  function handleRequest() {
    setError(null);

    startTransition(async () => {
      const form = new FormData();
      form.set('identifier', identifier);

      const result = await requestPasswordResetAction(
        form,
        captchaToken ?? undefined
      );

      // A used token cannot be replayed, so clear it whatever happened.
      resetCaptcha();

      if (!result.success) {
        setError(result.error);

        return;
      }

      // Deliberately the same message whatever happened server-side — this
      // screen must not reveal whether an account matched.
      setNotice(t('codeSentNotice'));
      setStep('reset');
    });
  }

  function handleReset() {
    setError(null);

    startTransition(async () => {
      const form = new FormData();
      form.set('identifier', identifier);
      form.set('code', code);
      form.set('password', password);
      form.set('confirmPassword', confirmPassword);

      const result = await resetPasswordWithOtpAction(
        form,
        captchaToken ?? undefined
      );

      resetCaptcha();

      if (!result.success) {
        setError(result.error);

        return;
      }

      router.push('/login');
    });
  }

  const captchaBlocking = isCaptchaRequired() && !captchaToken;

  return (
    <div className="w-full space-y-6">
      <div>
        <Heading level={1}>{t('title')}</Heading>
        <Text className="mt-1">{t('subtitle')}</Text>
      </div>

      {error && <AlertBanner color="red">{error}</AlertBanner>}
      {notice && <AlertBanner color="green">{notice}</AlertBanner>}

      {step === 'identify' ? (
        <>
          <FieldGroup>
            <Field>
              <Label>{t('identifierLabel')}</Label>
              <Input
                name="identifier"
                autoComplete="username"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                disabled={isPending}
              />
              <Description>{t('identifierHint')}</Description>
            </Field>
          </FieldGroup>

          <TurnstileWidget
            key={captchaResetKey}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />

          <Button
            type="button"
            color="brand-green"
            className="w-full cursor-pointer disabled:cursor-not-allowed"
            onClick={handleRequest}
            disabled={isPending || !identifier.trim() || captchaBlocking}
          >
            {isPending ? t('sending') : t('sendCode')}
          </Button>
        </>
      ) : (
        <>
          <FieldGroup>
            <Field>
              <Label>{t('codeLabel')}</Label>
              <Input
                name="code"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                disabled={isPending}
              />
            </Field>

            <Field>
              <Label>{t('newPasswordLabel')}</Label>
              <Input
                type="password"
                name="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isPending}
              />
            </Field>

            <Field>
              <Label>{t('confirmPasswordLabel')}</Label>
              <Input
                type="password"
                name="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isPending}
              />
            </Field>
          </FieldGroup>

          <TurnstileWidget
            key={captchaResetKey}
            onSuccess={setCaptchaToken}
            onExpire={() => setCaptchaToken(null)}
            onError={() => setCaptchaToken(null)}
          />

          <Button
            type="button"
            color="brand-green"
            className="w-full cursor-pointer disabled:cursor-not-allowed"
            onClick={handleReset}
            disabled={
              isPending ||
              code.length !== 6 ||
              !password ||
              !confirmPassword ||
              captchaBlocking
            }
          >
            {isPending ? t('resetting') : t('resetPassword')}
          </Button>

          <Button
            type="button"
            plain
            className="w-full cursor-pointer disabled:cursor-not-allowed"
            onClick={() => {
              setStep('identify');
              setNotice(null);
              setError(null);
            }}
            disabled={isPending}
          >
            {t('back')}
          </Button>
        </>
      )}

      <Text className="text-center text-sm">
        <Link
          href="/login"
          className="font-semibold text-blue-600 hover:text-blue-500"
        >
          {t('backToLogin')}
        </Link>
      </Text>
    </div>
  );
}
