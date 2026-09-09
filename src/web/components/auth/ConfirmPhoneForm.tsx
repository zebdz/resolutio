'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import { Text } from '@/src/web/components/catalyst/text';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { OtpInput } from './OtpInput';
import { TurnstileWidget } from './TurnstileWidget';
import { isCaptchaRequired } from './captchaRequired';
import { deriveOtpControls } from './otpControls';
import {
  confirmPhoneAction,
  requestConfirmationOtpAction,
} from '@/src/web/actions/auth/confirmPhone';
import { logoutAction } from '@/src/web/actions/auth/auth';
import { formatCountdown } from '@/src/web/lib/formatCountdown';
import { useCountdown } from '@/src/web/hooks/useCountdown';

type Props = {
  maskedPhone: string;
  // Reported by the server: a code was sent and can still be entered.
  hasPendingCode: boolean;
  // Reported by the server: seconds until the throttle allows another code.
  retryAfterSeconds: number;
};

export function ConfirmPhoneForm({
  maskedPhone,
  hasPendingCode: initialHasPendingCode,
  retryAfterSeconds,
}: Props) {
  const t = useTranslations('auth.confirmPhone');
  const tOtp = useTranslations('otp');
  const router = useRouter();
  const [isVerifying, startVerifying] = useTransition();
  const [isRequesting, startRequesting] = useTransition();
  const isPending = isVerifying || isRequesting;
  const [error, setError] = useState<string | null>(null);
  const [hasPendingCode, setHasPendingCode] = useState(initialHasPendingCode);
  const [backdoorCode, setBackdoorCode] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useCountdown(retryAfterSeconds);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [captchaResetKey, setCaptchaResetKey] = useState(0);

  const controls = deriveOtpControls({
    hasPendingCode,
    otpCodeLength: otpCode.length,
    isPending,
    resendCountdown,
    captchaRequired: isCaptchaRequired(),
    hasCaptchaToken: captchaToken !== null,
  });

  // Turnstile tokens are single-use. Remount the widget after every request
  // so a failed one (throttled, delivery error, rejected token) leaves a fresh
  // challenge behind, not a "success" badge next to a dead button.
  function resetCaptcha() {
    setCaptchaToken(null);
    setCaptchaResetKey((k) => k + 1);
  }

  function handleVerify() {
    if (!controls.canVerify) {
      return;
    }

    setError(null);

    startVerifying(async () => {
      const formData = new FormData();
      formData.set('code', otpCode);

      const result = await confirmPhoneAction(formData);

      if (!result.success) {
        setError(result.error);
      } else {
        router.push('/privacy-setup');
      }
    });
  }

  // Every code request — the first one included — is explicit and goes
  // through the CAPTCHA. The form used to request a code on mount whenever
  // it arrived without one, which the CAPTCHA-enforced action rejects.
  function handleRequestCode() {
    if (!controls.canRequestCode) {
      return;
    }

    setError(null);

    startRequesting(async () => {
      const result = await requestConfirmationOtpAction(
        captchaToken ?? undefined
      );

      resetCaptcha();

      if (!result.success) {
        setError(result.error);

        return;
      }

      setHasPendingCode(true);
      setBackdoorCode(result.data.backdoorCode ?? null);
      setOtpCode('');
      setResendCountdown(result.data.retryAfterSeconds);
    });
  }

  const requestLabel =
    controls.requestLabel === 'resendIn'
      ? tOtp('resendIn', { time: formatCountdown(resendCountdown) })
      : tOtp(controls.requestLabel);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <Text>
          {hasPendingCode
            ? t('subtitle', { phone: maskedPhone })
            : t('subtitleNoCode', { phone: maskedPhone })}
        </Text>
      </div>

      {error && <AlertBanner color="red">{error}</AlertBanner>}

      {/* Backdoor code display (dev only) */}
      {backdoorCode && (
        <AlertBanner color="blue">
          {tOtp('backdoorHint', { code: backdoorCode })}
        </AlertBanner>
      )}

      <div className="space-y-4">
        {hasPendingCode && (
          <>
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
              disabled={!controls.canVerify}
              onClick={handleVerify}
            >
              {isVerifying ? t('verifying') : t('verify')}
            </Button>
          </>
        )}

        {/* CAPTCHA gates every code request; hidden while the throttle runs */}
        {resendCountdown <= 0 && (
          <TurnstileWidget
            key={captchaResetKey}
            onSuccess={(token) => setCaptchaToken(token)}
            onError={() => setCaptchaToken(null)}
            onExpire={() => setCaptchaToken(null)}
          />
        )}

        {/* No code to enter yet: requesting one is the primary action */}
        {!hasPendingCode && (
          <Button
            type="button"
            color="brand-green"
            className="w-full"
            disabled={!controls.canRequestCode}
            onClick={handleRequestCode}
          >
            {requestLabel}
          </Button>
        )}

        <div className="flex items-center justify-between">
          <form action={logoutAction}>
            <Button type="submit" plain disabled={isPending}>
              {t('logout')}
            </Button>
          </form>

          {hasPendingCode && (
            <Button
              type="button"
              plain
              onClick={handleRequestCode}
              disabled={!controls.canRequestCode}
            >
              {requestLabel}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
