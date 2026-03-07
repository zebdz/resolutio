'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition } from 'react';
import { useRouter } from '@/src/i18n/routing';
import { Button } from '@/app/components/catalyst/button';
import {
  Field,
  Label,
  Description,
  FieldGroup,
} from '@/app/components/catalyst/fieldset';
import { Input } from '@/app/components/catalyst/input';
import { Select } from '@/app/components/catalyst/select';
import { Switch, SwitchField } from '@/app/components/catalyst/switch';
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
    nickname: string;
    allowFindByName: boolean;
    allowFindByPhone: boolean;
  };
};

export function AccountForm({ user }: Props) {
  const t = useTranslations('account');
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
  });

  const prefsChanged =
    prefValues.language !== user.language ||
    prefValues.nickname !== user.nickname;

  const privacyChanged =
    privValues.allowFindByName !== user.allowFindByName ||
    privValues.allowFindByPhone !== user.allowFindByPhone;

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

    startPrivTransition(async () => {
      const result = await updateProfileAction(formData);

      if (!result.success) {
        setPrivError(result.error);
      } else {
        setPrivSuccess(t('privacySuccess'));
      }
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
