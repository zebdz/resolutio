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
} from '@/src/web/components/catalyst/dialog';
import { Button } from '@/src/web/components/catalyst/button';
import { Input } from '@/src/web/components/catalyst/input';
import { Textarea } from '@/src/web/components/catalyst/textarea';
import { Select } from '@/src/web/components/catalyst/select';
import {
  Field,
  Label,
  Description,
} from '@/src/web/components/catalyst/fieldset';
import { ErrorMessage } from '@/src/web/components/catalyst/fieldset';
import { SwitchField, Switch } from '@/src/web/components/catalyst/switch';
import { toast } from 'sonner';
import {
  createOrganizationAction,
  getAdminOrganizationsAction,
  getRootMultiMembershipInfoAction,
} from '@/src/web/actions/organization/organization';

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
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [adminOrganizations, setAdminOrganizations] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [isLoadingOrgs, setIsLoadingOrgs] = useState(false);
  const [autoJoin, setAutoJoin] = useState(true);
  const [selectedParentId, setSelectedParentId] = useState('');
  const [allowMultiTreeMembership, setAllowMultiTreeMembership] =
    useState(false);
  const [parentRootMultiMembershipInfo, setParentRootMultiMembershipInfo] =
    useState<{ allowed: boolean; rootOrgName: string } | null>(null);

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
    setAutoJoin(true);
    setSelectedParentId('');
    setAllowMultiTreeMembership(false);
    setParentRootMultiMembershipInfo(null);

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
      if (result.data.autoJoinFailed) {
        toast.error(t('autoJoinFailed'));
      }

      resetForm();

      onClose();
      router.refresh();
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
                  value={selectedParentId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setSelectedParentId(value);

                    if (value) {
                      setAutoJoin(false);
                      setAllowMultiTreeMembership(false);
                      getRootMultiMembershipInfoAction(value).then((result) => {
                        if (result.success) {
                          setParentRootMultiMembershipInfo(result.data);
                        }
                      });
                    } else {
                      setAutoJoin(true);
                      setParentRootMultiMembershipInfo(null);
                    }
                  }}
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

            {/* Auto-join toggle (hidden when parent org is selected) */}
            {!selectedParentId && (
              <SwitchField>
                <Label>{t('autoJoin')}</Label>
                <Description>{t('autoJoinDescription')}</Description>
                <Switch
                  checked={autoJoin}
                  onChange={setAutoJoin}
                  color="brand-green"
                  disabled={isSubmitting}
                />
              </SwitchField>
            )}
            <input
              type="hidden"
              name="autoJoin"
              value={autoJoin ? 'true' : 'false'}
            />

            {/* Multi-tree membership setting */}
            {!selectedParentId ? (
              <SwitchField>
                <Label>{t('allowMultiTreeMembership')}</Label>
                <Description>
                  {t('allowMultiTreeMembershipDescription')}
                </Description>
                <Switch
                  checked={allowMultiTreeMembership}
                  onChange={setAllowMultiTreeMembership}
                  color="brand-green"
                  disabled={isSubmitting}
                />
              </SwitchField>
            ) : parentRootMultiMembershipInfo ? (
              <div className="text-sm text-zinc-600 dark:text-zinc-400">
                {t('multiMembershipInherited', {
                  status: parentRootMultiMembershipInfo.allowed
                    ? t('allowed')
                    : t('disallowed'),
                  rootOrgName: parentRootMultiMembershipInfo.rootOrgName,
                })}
              </div>
            ) : null}

            {!selectedParentId && (
              <input
                type="hidden"
                name="allowMultiTreeMembership"
                value={allowMultiTreeMembership ? 'true' : 'false'}
              />
            )}
          </div>
        </DialogBody>

        <DialogActions>
          <Button plain onClick={handleClose} disabled={isSubmitting}>
            {t('cancel')}
          </Button>
          <Button type="submit" color="brand-green" disabled={isSubmitting}>
            {isSubmitting ? t('creating') : t('submit')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
