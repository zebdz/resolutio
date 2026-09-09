'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/src/web/components/catalyst/button';
import {
  Field,
  Label,
  Description,
  FieldGroup,
} from '@/src/web/components/catalyst/fieldset';
import { Input } from '@/src/web/components/catalyst/input';
import { Select } from '@/src/web/components/catalyst/select';
import { Switch, SwitchField } from '@/src/web/components/catalyst/switch';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { updateProfileAction } from '@/src/web/actions/user/user';
import {
  updateEmailAction,
  requestEmailConfirmationAction,
  confirmEmailAction,
} from '@/src/web/actions/user/email';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Locale } from '@/src/i18n/locales';
import { useCountdown } from '@/src/web/hooks/useCountdown';
import { deriveOtpControls } from '@/src/web/components/auth/otpControls';
import { formatCountdown } from '@/src/web/lib/formatCountdown';
type Props = {
  user: {
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    phoneNumber: string;
    language: string;
    createdAt: Date;
    nickname: string;
    allowFindByName: boolean;
    allowFindByPhone: boolean;
    allowFindByAddress: boolean;
    email: string | null;
    emailConfirmed: boolean;
  };
  // Reported by the server: whether a code for the current address can still
  // be entered, and seconds until another may be requested.
  emailCode: {
    hasPendingCode: boolean;
    retryAfterSeconds: number;
  };
};

export function AccountForm({ user, emailCode }: Props) {
  const t = useTranslations('account');
  const tOtp = useTranslations('otp');
  const router = useRouter();

  // --- Preferences form state ---
  const [isPrefPending, startPrefTransition] = useTransition();
  const [prefError, setPrefError] = useState<string | null>(null);
  const [prefSuccess, setPrefSuccess] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [prefValues, setPrefValues] = useState({
    language: user.language,
    nickname: user.nickname,
  });

  // --- Privacy form state ---
  const [isPrivPending, startPrivTransition] = useTransition();
  const [privError, setPrivError] = useState<string | null>(null);
  const [privSuccess, setPrivSuccess] = useState<string | null>(null);
  const [privValues, setPrivValues] = useState({
    allowFindByName: user.allowFindByName,
    allowFindByPhone: user.allowFindByPhone,
    allowFindByAddress: user.allowFindByAddress,
  });

  // --- Email form state ---
  const [isEmailPending, startEmailTransition] = useTransition();
  const [emailError, setEmailError] = useState<string | null>(null);
  const [emailSuccess, setEmailSuccess] = useState<string | null>(null);
  const [emailValue, setEmailValue] = useState(user.email ?? '');
  const [hasPendingCode, setHasPendingCode] = useState(
    emailCode.hasPendingCode
  );
  const [resendCountdown, setResendCountdown] = useCountdown(
    emailCode.retryAfterSeconds
  );
  const [confirmCode, setConfirmCode] = useState('');

  const emailChanged =
    emailValue.trim().toLowerCase() !== (user.email ?? '').toLowerCase();

  const codeControls = deriveOtpControls({
    hasPendingCode,
    otpCodeLength: confirmCode.length,
    isPending: isEmailPending,
    resendCountdown,
    // Requests here are authenticated and throttled; no CAPTCHA.
    captchaRequired: false,
    hasCaptchaToken: false,
  });

  const requestCodeLabel =
    codeControls.requestLabel === 'resendIn'
      ? tOtp('resendIn', { time: formatCountdown(resendCountdown) })
      : tOtp(codeControls.requestLabel);

  const prefsChanged =
    prefValues.language !== user.language ||
    prefValues.nickname !== user.nickname;

  const privacyChanged =
    privValues.allowFindByName !== user.allowFindByName ||
    privValues.allowFindByPhone !== user.allowFindByPhone ||
    privValues.allowFindByAddress !== user.allowFindByAddress;

  function handlePrefChange(
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) {
    const { name, value } = e.target;
    setPrefValues((prev) => ({ ...prev, [name]: value }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[name];

        return newErrors;
      });
    }

    if (prefError) {
      setPrefError(null);
    }

    if (prefSuccess) {
      setPrefSuccess(null);
    }
  }

  async function handlePrefSubmit(formData: FormData) {
    setPrefError(null);
    setPrefSuccess(null);
    setFieldErrors({});

    formData.set('nickname', prefValues.nickname);

    startPrefTransition(async () => {
      const result = await updateProfileAction(formData);

      if (!result.success) {
        setPrefError(result.error);

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        setPrefSuccess(t('updateSuccess'));

        if (prefValues.language !== user.language) {
          setTimeout(() => {
            router.push(`/account`, { locale: prefValues.language as Locale });
          }, 500);
        }
      }
    });
  }

  async function handlePrivSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPrivError(null);
    setPrivSuccess(null);

    const formData = new FormData();
    formData.set('allowFindByName', String(privValues.allowFindByName));
    formData.set('allowFindByPhone', String(privValues.allowFindByPhone));
    formData.set('allowFindByAddress', String(privValues.allowFindByAddress));

    startPrivTransition(async () => {
      const result = await updateProfileAction(formData);

      if (!result.success) {
        setPrivError(result.error);
      } else {
        setPrivSuccess(t('privacySuccess'));
      }
    });
  }

  function handleEmailSave() {
    setEmailError(null);
    setEmailSuccess(null);

    startEmailTransition(async () => {
      const form = new FormData();
      form.set('email', emailValue);

      const result = await updateEmailAction(form);

      if (!result.success) {
        setEmailError(result.error);

        return;
      }

      setHasPendingCode(true);
      setResendCountdown(result.data.retryAfterSeconds);
      setConfirmCode('');
      setEmailSuccess(t('email.codeSent'));
      router.refresh();
    });
  }

  function handleRequestCode() {
    if (!codeControls.canRequestCode) {
      return;
    }

    setEmailError(null);
    setEmailSuccess(null);

    startEmailTransition(async () => {
      const result = await requestEmailConfirmationAction();

      if (!result.success) {
        setEmailError(result.error);

        return;
      }

      setHasPendingCode(true);
      setResendCountdown(result.data.retryAfterSeconds);
      setConfirmCode('');
      setEmailSuccess(t('email.codeSent'));
    });
  }

  function handleConfirmCode() {
    setEmailError(null);
    setEmailSuccess(null);

    startEmailTransition(async () => {
      const form = new FormData();
      form.set('code', confirmCode);

      const result = await confirmEmailAction(form);

      if (!result.success) {
        setEmailError(result.error);

        return;
      }

      setHasPendingCode(false);
      setConfirmCode('');
      setEmailSuccess(t('email.confirmed'));
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      {/* Preferences: language + nickname */}
      <form action={handlePrefSubmit} className="space-y-8">
        {prefError && <AlertBanner color="red">{prefError}</AlertBanner>}
        {prefSuccess && <AlertBanner color="green">{prefSuccess}</AlertBanner>}

        <FieldGroup>
          <Field>
            <Label>{t('language')}</Label>
            <Select
              name="language"
              value={prefValues.language}
              onChange={handlePrefChange}
              disabled={isPrefPending}
              invalid={!!fieldErrors.language}
            >
              <option value="en">{t('languageEn')}</option>
              <option value="ru">{t('languageRu')}</option>
            </Select>
            {fieldErrors.language && (
              <p className="text-sm text-red-600">{fieldErrors.language[0]}</p>
            )}
          </Field>

          <Field>
            <Label>{t('nicknameLabel')}</Label>
            <Input
              name="nickname"
              value={prefValues.nickname}
              onChange={handlePrefChange}
              disabled={isPrefPending}
              invalid={!!fieldErrors.nickname}
            />
            <Description>{t('nicknameHint')}</Description>
            {fieldErrors.nickname && (
              <p className="text-sm text-red-600">{fieldErrors.nickname[0]}</p>
            )}
          </Field>
        </FieldGroup>

        <div className="flex justify-end">
          <Button type="submit" disabled={isPrefPending || !prefsChanged}>
            {isPrefPending ? t('saving') : t('save')}
          </Button>
        </div>
      </form>

      {/* Email: optional, confirmable — gates self-service password reset */}
      <div className="border-t border-zinc-200 pt-8 dark:border-zinc-700">
        <h3 className="mb-1 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('email.title')}
        </h3>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {t('email.description')}
        </p>

        {emailError && <AlertBanner color="red">{emailError}</AlertBanner>}
        {emailSuccess && (
          <AlertBanner color="green">{emailSuccess}</AlertBanner>
        )}

        <FieldGroup>
          <Field>
            <Label>{t('email.label')}</Label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
              <Input
                type="email"
                name="email"
                autoComplete="email"
                inputMode="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                disabled={isEmailPending}
                className="sm:flex-1"
              />
              <Button
                type="button"
                onClick={handleEmailSave}
                disabled={isEmailPending || !emailChanged || !emailValue.trim()}
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                {isEmailPending ? t('saving') : t('save')}
              </Button>
            </div>
            <Description>
              {user.email ? (
                user.emailConfirmed ? (
                  <Badge color="green">{t('email.confirmedBadge')}</Badge>
                ) : (
                  <Badge color="amber">{t('email.unconfirmedBadge')}</Badge>
                )
              ) : (
                t('email.none')
              )}
            </Description>
          </Field>

          {/* Rendered from server state: a reload keeps the code entry open
              while a code is pending, and offers to send one otherwise */}
          {user.email && !user.emailConfirmed && hasPendingCode && (
            <Field>
              <Label>{t('email.codeLabel')}</Label>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                <Input
                  name="code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={confirmCode}
                  onChange={(e) => setConfirmCode(e.target.value)}
                  disabled={isEmailPending}
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  onClick={handleConfirmCode}
                  disabled={!codeControls.canVerify}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  {t('email.confirm')}
                </Button>
                <Button
                  type="button"
                  plain
                  onClick={handleRequestCode}
                  disabled={!codeControls.canRequestCode}
                  className="cursor-pointer disabled:cursor-not-allowed"
                >
                  {requestCodeLabel}
                </Button>
              </div>
              <Description>{t('email.codeHint')}</Description>
            </Field>
          )}

          {user.email && !user.emailConfirmed && !hasPendingCode && (
            <Field>
              <Button
                type="button"
                onClick={handleRequestCode}
                disabled={!codeControls.canRequestCode}
                className="cursor-pointer disabled:cursor-not-allowed"
              >
                {requestCodeLabel}
              </Button>
              <Description>{t('email.noCodeHint')}</Description>
            </Field>
          )}
        </FieldGroup>
      </div>

      {/* Privacy settings: separate form */}
      <div className="border-t border-zinc-200 pt-8 dark:border-zinc-700">
        <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
          {t('privacySection')}
        </h3>

        <form onSubmit={handlePrivSubmit} className="space-y-8">
          {privError && <AlertBanner color="red">{privError}</AlertBanner>}
          {privSuccess && (
            <AlertBanner color="green">{privSuccess}</AlertBanner>
          )}

          <FieldGroup>
            <SwitchField>
              <Label>{t('allowFindByNameLabel')}</Label>
              <Description>{t('allowFindByNameDescription')}</Description>
              <Switch
                color="brand-green"
                checked={privValues.allowFindByName}
                onChange={(checked) => {
                  setPrivValues((prev) => ({
                    ...prev,
                    allowFindByName: checked,
                  }));

                  if (privError) {
                    setPrivError(null);
                  }

                  if (privSuccess) {
                    setPrivSuccess(null);
                  }
                }}
                disabled={isPrivPending}
              />
            </SwitchField>

            <SwitchField>
              <Label>{t('allowFindByPhoneLabel')}</Label>
              <Description>{t('allowFindByPhoneDescription')}</Description>
              <Switch
                color="brand-green"
                checked={privValues.allowFindByPhone}
                onChange={(checked) => {
                  setPrivValues((prev) => ({
                    ...prev,
                    allowFindByPhone: checked,
                  }));

                  if (privError) {
                    setPrivError(null);
                  }

                  if (privSuccess) {
                    setPrivSuccess(null);
                  }
                }}
                disabled={isPrivPending}
              />
            </SwitchField>

            <SwitchField>
              <Label>{t('allowFindByAddressLabel')}</Label>
              <Description>{t('allowFindByAddressDescription')}</Description>
              <Switch
                color="brand-green"
                checked={privValues.allowFindByAddress}
                onChange={(checked) => {
                  setPrivValues((prev) => ({
                    ...prev,
                    allowFindByAddress: checked,
                  }));

                  if (privError) {
                    setPrivError(null);
                  }

                  if (privSuccess) {
                    setPrivSuccess(null);
                  }
                }}
                disabled={isPrivPending}
              />
            </SwitchField>
          </FieldGroup>

          <div className="flex justify-end">
            <Button type="submit" disabled={isPrivPending || !privacyChanged}>
              {isPrivPending ? t('privacySaving') : t('privacySave')}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
