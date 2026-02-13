'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { Select } from '@/app/components/catalyst/select';
import { Textarea } from '@/app/components/catalyst/textarea';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { requestJoinParentAction } from '@/web/actions/joinParentRequest';

interface JoinParentFormProps {
  childOrgId: string;
  availableOrgs: Array<{ id: string; name: string }>;
}

export function JoinParentForm({
  childOrgId,
  availableOrgs,
}: JoinParentFormProps) {
  const t = useTranslations('organization.joinParent');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    formData.append('childOrgId', childOrgId);

    const result = await requestJoinParentAction(formData);

    if (result.success) {
      router.back();
      router.refresh();
    } else {
      setError(result.error);
      setIsSubmitting(false);
    }
  };

  if (availableOrgs.length === 0) {
    return (
      <div className="rounded-lg border-2 border-dashed border-zinc-300 p-12 text-center dark:border-zinc-700">
        <p className="text-lg text-zinc-500 dark:text-zinc-400">
          {t('noOrganizationsAvailable')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/10">
          <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      <Field>
        <Label htmlFor="parentOrgId">{t('selectParent')}</Label>
        <Select
          id="parentOrgId"
          name="parentOrgId"
          required
          disabled={isSubmitting}
        >
          <option value="">{t('selectParentPlaceholder')}</option>
          {availableOrgs.map((org) => (
            <option key={org.id} value={org.id}>
              {org.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field>
        <Label htmlFor="message">{t('message')}</Label>
        <Textarea
          id="message"
          name="message"
          rows={4}
          placeholder={t('messagePlaceholder')}
          required
          disabled={isSubmitting}
        />
      </Field>

      <div className="flex gap-4">
        <Button
          type="button"
          plain
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          {tCommon('cancel')}
        </Button>
        <Button type="submit" color="indigo" disabled={isSubmitting}>
          {isSubmitting ? t('submitting') : t('submit')}
        </Button>
      </div>
    </form>
  );
}
