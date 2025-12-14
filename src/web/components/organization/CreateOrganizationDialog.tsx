'use client';

import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import {
  Dialog,
  DialogTitle,
  DialogDescription,
  DialogBody,
  DialogActions,
} from '@/app/components/catalyst/dialog';
import { Button } from '@/app/components/catalyst/button';
import { Input } from '@/app/components/catalyst/input';
import { Textarea } from '@/app/components/catalyst/textarea';
import { Select } from '@/app/components/catalyst/select';
import { Field, Label } from '@/app/components/catalyst/fieldset';
import { ErrorMessage } from '@/app/components/catalyst/fieldset';
import {
  createOrganizationAction,
  getAdminOrganizationsAction,
} from '@/web/actions/organization';

interface CreateOrganizationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  locale: string;
}

export function CreateOrganizationDialog({
  isOpen,
  onClose,
  locale,
}: CreateOrganizationDialogProps) {
  const t = useTranslations('organization.create');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [adminOrganizations, setAdminOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);

  // Load admin organizations when dialog opens
  useEffect(() => {
    const loadAdminOrganizations = async () => {
      setIsLoadingOrgs(true);
      const result = await getAdminOrganizationsAction();
      if (result.success) {
        setAdminOrganizations(result.data.organizations);
      }
      setIsLoadingOrgs(false);
    };

    if (isOpen) {
      loadAdminOrganizations();
    }
  }, [isOpen]);

  const resetForm = () => {
    setIsSubmitting(false);
    setError(null);
    setFieldErrors({});
    // Reset form fields
    if (formRef.current) {
      formRef.current.reset();
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setFieldErrors({});

    const formData = new FormData(event.currentTarget);
    const result = await createOrganizationAction(formData);

    if (result.success) {
      resetForm();

      onClose();
      router.refresh();
      // Optionally redirect to the organization page
      // router.push(`/${locale}/organizations/${result.data.organizationId}`);
    } else {
      setError(result.error);
      if (result.fieldErrors) {
        setFieldErrors(result.fieldErrors);
      }
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onClose={handleClose}>
      <DialogTitle>{t('title')}</DialogTitle>
      <DialogDescription>{t('descriptionPlaceholder')}</DialogDescription>

      <form ref={formRef} onSubmit={handleSubmit}>
        <DialogBody>
          <div className="space-y-6">
            {error && (
              <div className="rounded-md bg-red-50 p-4 dark:bg-red-900/10">
                <p className="text-sm text-red-800 dark:text-red-200">
                  {error}
                </p>
              </div>
            )}

            <Field>
              <Label htmlFor="name">{t('name')}</Label>
              <Input
                id="name"
                name="name"
                type="text"
                placeholder={t('namePlaceholder')}
                required
                disabled={isSubmitting}
                invalid={!!fieldErrors.name}
              />
              {fieldErrors.name && (
                <ErrorMessage>{fieldErrors.name[0]}</ErrorMessage>
              )}
            </Field>

            <Field>
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea
                id="description"
                name="description"
                rows={4}
                placeholder={t('descriptionPlaceholder')}
                required
                disabled={isSubmitting}
                invalid={!!fieldErrors.description}
              />
              {fieldErrors.description && (
                <ErrorMessage>{fieldErrors.description[0]}</ErrorMessage>
              )}
            </Field>

            {/* Parent organization selector */}
            {adminOrganizations.length > 0 && (
              <Field>
                <Label htmlFor="parentId">{t('parentOrganization')}</Label>
                <Select
                  id="parentId"
                  name="parentId"
                  disabled={isSubmitting || isLoadingOrgs}
                >
                  <option value="">{t('noParent')}</option>
                  {adminOrganizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name}
                    </option>
                  ))}
                </Select>
                {fieldErrors.parentId && (
                  <ErrorMessage>{fieldErrors.parentId[0]}</ErrorMessage>
                )}
              </Field>
            )}
          </div>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={handleClose} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button type="submit" color="blue" disabled={isSubmitting}>
            {isSubmitting ? t('creating') : t('submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
