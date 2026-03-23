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
import { Switch, SwitchField } from '@/src/web/components/catalyst/switch';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { completePrivacySetupAction } from '@/src/web/actions/user/user';
import { consumeReturnToClient } from '@/web/lib/returnTo.client';

type Props = {
  nickname: string;
};

export function PrivacySetupForm({ nickname }: Props) {
  const t = useTranslations('privacySetup');
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const [formValues, setFormValues] = useState({
    nickname,
    allowFindByName: false,
    allowFindByPhone: false,
  });

  async function handleSubmit(formData: FormData) {
    setError(null);
    setFieldErrors({});

    // Add switch values as hidden fields
    formData.set('nickname', formValues.nickname);
    formData.set('allowFindByName', String(formValues.allowFindByName));
    formData.set('allowFindByPhone', String(formValues.allowFindByPhone));

    startTransition(async () => {
      const result = await completePrivacySetupAction(formData);

      if (!result.success) {
        setError(result.error);

        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
      } else {
        const returnTo = consumeReturnToClient();
        router.push(returnTo || '/home');
      }
    });
  }

  return (
    <form action={handleSubmit} className="space-y-8">
      {error && <AlertBanner color="red">{error}</AlertBanner>}

      <FieldGroup>
        <Field>
          <Label>{t('nicknameLabel')}</Label>
          <Input
            name="nickname"
            value={formValues.nickname}
            onChange={(e) =>
              setFormValues((prev) => ({ ...prev, nickname: e.target.value }))
            }
            placeholder={t('nicknamePlaceholder')}
            disabled={isPending}
            invalid={!!fieldErrors.nickname}
          />
          <Description>{t('nicknameHint')}</Description>
          {fieldErrors.nickname && (
            <p className="text-sm text-red-600">{fieldErrors.nickname[0]}</p>
          )}
        </Field>

        <SwitchField>
          <Label>{t('allowFindByNameLabel')}</Label>
          <Description>{t('allowFindByNameDescription')}</Description>
          <Switch
            color="brand-green"
            checked={formValues.allowFindByName}
            onChange={(checked) =>
              setFormValues((prev) => ({ ...prev, allowFindByName: checked }))
            }
            disabled={isPending}
          />
        </SwitchField>

        <SwitchField>
          <Label>{t('allowFindByPhoneLabel')}</Label>
          <Description>{t('allowFindByPhoneDescription')}</Description>
          <Switch
            color="brand-green"
            checked={formValues.allowFindByPhone}
            onChange={(checked) =>
              setFormValues((prev) => ({ ...prev, allowFindByPhone: checked }))
            }
            disabled={isPending}
          />
        </SwitchField>
      </FieldGroup>

      <div className="flex justify-end">
        <Button type="submit" disabled={isPending}>
          {isPending ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
