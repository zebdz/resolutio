'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, useEffect, useCallback, useRef } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import { Text } from '@/app/components/catalyst/text';
import { AlertBanner } from '@/app/components/catalyst/alert-banner';
import { OtpInput } from './OtpInput';
import { TurnstileWidget } from './TurnstileWidget';
import {
  confirmPhoneAction,
  requestConfirmationOtpAction,
} from '@/web/actions/confirmPhone';
import { logoutAction } from '@/web/actions/auth';

type Props = {
  maskedPhone: string;
};

type ConfirmPhoneData = {
  otpId: string;
  backdoorCode?: string;
  expiresInSeconds?: number;
};

export function ConfirmPhoneForm({ maskedPhone }: Props) {
  const t = useTranslations('auth.confirmPhone');
  const tOtp = useTranslations('otp');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [otpId, setOtpId] = useState<string | null>(null);
  const [backdoorCode, setBackdoorCode] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState('');
  const [resendCountdown, setResendCountdown] = useState(0);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const hasInitialOtp = useRef(false);

  // Load initial OTP data from sessionStorage (set by register/login)
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const raw = sessionStorage.getItem('confirmPhoneData');

    if (raw) {
      try {
        const data: ConfirmPhoneData = JSON.parse(raw);
        setOtpId(data.otpId);
        setBackdoorCode(data.backdoorCode ?? null);
        setResendCountdown(60);
        hasInitialOtp.current = true;
      } catch {
        // Ignore parse errors
      }

      sessionStorage.removeItem('confirmPhoneData');
    }
  }, []);

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

  function handleVerify() {
    if (!otpId || otpCode.length < 6) {
      return;
    }

    setError(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set('otpId', otpId);
      formData.set('code', otpCode);

      const result = await confirmPhoneAction(formData);

      if (!result.success) {
        setError(result.error);
      } else {
        router.push('/privacy-setup');
      }
    });
  }

  const handleResend = useCallback(
    (token?: string | null) => {
      if (resendCountdown > 0) {
        return;
      }

      setError(null);

      startTransition(async () => {
        const result = await requestConfirmationOtpAction(
          token || captchaToken || undefined
        );

        if (!result.success) {
          setError(result.error);
        } else {
          setOtpId(result.data.otpId);
          setBackdoorCode(result.data.backdoorCode ?? null);
          setOtpCode('');
          setResendCountdown(60);
        }

        // Reset captcha after use so user must re-solve for next resend
        setCaptchaToken(null);
      });
    },
    [resendCountdown, captchaToken, startTransition]
  );

  // If no otpId from sessionStorage (e.g. direct navigation), request one
  // No CAPTCHA required for initial request — registration/login already verified
  useEffect(() => {
    // Small delay to let sessionStorage useEffect run first
    const timer = setTimeout(() => {
      if (!hasInitialOtp.current) {
        handleResend();
      }
    }, 100);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="w-full max-w-md space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <Text>{t('subtitle', { phone: maskedPhone })}</Text>
      </div>

      {error && <AlertBanner color="red">{error}</AlertBanner>}

      {/* Backdoor code display (dev only) */}
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
          disabled={isPending || otpCode.length < 6 || !otpId}
          onClick={handleVerify}
        >
          {isPending ? t('verifying') : t('verify')}
        </Button>

        {/* CAPTCHA required for resend */}
        {resendCountdown <= 0 && (
          <TurnstileWidget
            onSuccess={(token) => setCaptchaToken(token)}
            onError={() => setCaptchaToken(null)}
            onExpire={() => setCaptchaToken(null)}
          />
        )}

        <div className="flex items-center justify-between">
          <form action={logoutAction}>
            <Button type="submit" plain disabled={isPending}>
              {t('logout')}
            </Button>
          </form>

          <Button
            type="button"
            plain
            onClick={() => handleResend()}
            disabled={isPending || resendCountdown > 0 || !captchaToken}
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
