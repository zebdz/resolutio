'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import { AlertBanner } from '@/src/web/components/catalyst/alert-banner';
import { removeOrgAdminAction } from '@/web/actions/organization';
import { User } from '@/domain/user/User';

type Admin = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
  createdAt: Date;
};

type Props = {
  organizationId: string;
  admins: Admin[];
  currentUserId: string;
};

export function CurrentAdminsList({
  organizationId,
  admins,
  currentUserId,
}: Props) {
  const t = useTranslations('manageAdmins');
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  const handleRemoveAdmin = async (userId: string) => {
    setRemovingId(userId);
    setError(null);

    const result = await removeOrgAdminAction(organizationId, userId);

    if (result.success) {
      setConfirmRemoveId(null);
      router.refresh();
    } else {
      setError(result.error);
    }

    setRemovingId(null);
  };

  function formatName(admin: Admin) {
    return User.formatFullName(
      admin.firstName,
      admin.lastName,
      admin.middleName
    );
  }

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {t('currentAdmins')}
      </h3>

      {error && (
        <AlertBanner color="red" className="mb-4">
          {error}
        </AlertBanner>
      )}

      <div className="space-y-2">
        {admins.map((admin) => (
          <div
            key={admin.id}
            className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800"
          >
            <div className="min-w-0">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {formatName(admin)}{' '}
                <span className="text-zinc-400">(@{admin.nickname})</span>
              </p>
            </div>
            {admin.id !== currentUserId && (
              <div className="flex w-full items-center gap-2 sm:w-auto">
                {confirmRemoveId === admin.id ? (
                  <>
                    <Button
                      color="red"
                      onClick={() => handleRemoveAdmin(admin.id)}
                      disabled={removingId === admin.id}
                    >
                      {removingId === admin.id
                        ? t('removing')
                        : t('confirmRemove')}
                    </Button>
                    <Button
                      plain
                      onClick={() => setConfirmRemoveId(null)}
                      disabled={removingId === admin.id}
                    >
                      {t('cancel')}
                    </Button>
                  </>
                ) : (
                  <Button
                    outline
                    onClick={() => setConfirmRemoveId(admin.id)}
                    disabled={admins.length <= 1 || removingId !== null}
                  >
                    {t('removeAdmin')}
                  </Button>
                )}
              </div>
            )}
          </div>
        ))}
        {admins.length <= 1 && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t('lastAdminWarning')}
          </p>
        )}
      </div>
    </div>
  );
}
