'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import {
  Field,
  Label,
  Description,
} from '@/src/web/components/catalyst/fieldset';
import {
  getSystemSettingsAction,
  updateSystemSettingAction,
} from '@/src/web/actions/superadmin/systemSettings';

interface EditableSetting {
  key: string;
  labelKey: 'maxPerHour' | 'dailyTokenCap' | 'minOrgSize';
  min: number;
  max: number;
  value: string;
}

export function SystemSettingsPanel() {
  const t = useTranslations('superadmin.settings');
  const [settings, setSettings] = useState<EditableSetting[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [successKey, setSuccessKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const result = await getSystemSettingsAction();

      if (cancelled) {
        return;
      }

      if (result.success) {
        setSettings([
          {
            key: 'legal_check_max_per_admin_per_hour',
            labelKey: 'maxPerHour',
            min: 1,
            max: 1000,
            value: String(result.data.legalCheckMaxPerAdminPerHour),
          },
          {
            key: 'legal_check_daily_token_cap',
            labelKey: 'dailyTokenCap',
            min: 0,
            max: 10_000_000,
            value: String(result.data.legalCheckDailyTokenCap),
          },
          {
            key: 'legal_check_min_org_size',
            labelKey: 'minOrgSize',
            min: 0,
            max: 10_000,
            value: String(result.data.legalCheckMinOrgSize),
          },
        ]);
      } else {
        setErrorMessage(result.error);
      }

      setLoading(false);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleChange = (key: string, value: string) => {
    setSettings((prev) =>
      prev ? prev.map((s) => (s.key === key ? { ...s, value } : s)) : prev
    );
    setSuccessKey(null);
    setErrorMessage(null);
  };

  const handleSave = async (setting: EditableSetting) => {
    setSavingKey(setting.key);
    setErrorMessage(null);
    setSuccessKey(null);

    const result = await updateSystemSettingAction(setting.key, setting.value);

    if (result.success) {
      setSuccessKey(setting.key);
    } else {
      setErrorMessage(result.error);
    }

    setSavingKey(null);
  };

  if (loading) {
    return (
      <div className="h-32 animate-pulse rounded-lg bg-zinc-100 dark:bg-zinc-800" />
    );
  }

  if (!settings) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
        {errorMessage ?? t('loadError')}
      </div>
    );
  }

  return (
    <div className="space-y-6 rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {t('legalCheck.title')}
      </h2>

      {errorMessage && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {errorMessage}
        </div>
      )}

      <div className="space-y-5">
        {settings.map((setting) => (
          <div
            key={setting.key}
            className="flex flex-col gap-3 sm:flex-row sm:items-end"
          >
            <Field className="flex-1">
              <Label>{t(`legalCheck.${setting.labelKey}`)}</Label>
              <Description>
                {t(`legalCheck.${setting.labelKey}Description`)}
              </Description>
              <Input
                type="number"
                min={setting.min}
                max={setting.max}
                value={setting.value}
                onChange={(e) => handleChange(setting.key, e.target.value)}
              />
            </Field>
            <div className="flex items-center gap-2">
              <Button
                color="brand-green"
                onClick={() => handleSave(setting)}
                disabled={savingKey === setting.key}
              >
                {savingKey === setting.key ? t('saving') : t('save')}
              </Button>
              {successKey === setting.key && (
                <span className="text-sm text-green-700 dark:text-green-300">
                  {t('saved')}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
