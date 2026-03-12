'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/app/components/catalyst/button';
import { revokeInviteAction } from '@/web/actions/invitation';
import { User } from '@/domain/user/User';

type PendingInvite = {
  id: string;
  inviteeId: string;
  inviterId: string;
  createdAt: Date;
};

type InviteeUser = {
  id: string;
  firstName: string;
  lastName: string;
  middleName: string | null;
  nickname: string;
};

export function PendingMemberInvites({
  initialInvites,
  inviteeUsers = [],
}: {
  organizationId: string;
  initialInvites: PendingInvite[];
  inviteeUsers?: InviteeUser[];
}) {
  const t = useTranslations('manageMembers');
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);

    try {
      await revokeInviteAction(invitationId);
      router.refresh();
    } finally {
      setRevokingId(null);
    }
  };

  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
      <h3 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-100">
        {t('pendingInvites')}
      </h3>

      {initialInvites.length === 0 ? (
        <p className="text-sm text-zinc-500">{t('noInvites')}</p>
      ) : (
        <div className="space-y-2">
          {initialInvites.map((invite) => {
            const invitee = inviteeUsers.find((u) => u.id === invite.inviteeId);
            const displayName = invitee
              ? `${User.formatFullName(invitee.firstName, invitee.lastName, invitee.middleName)} (@${invitee.nickname})`
              : invite.inviteeId;

            return (
              <div
                key={invite.id}
                className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-zinc-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-700 dark:bg-zinc-800"
              >
                <div className="min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100">
                    {displayName}
                  </p>
                </div>
                <Button
                  className="w-full sm:w-auto"
                  color="red"
                  onClick={() => handleRevoke(invite.id)}
                  disabled={revokingId === invite.id}
                >
                  {revokingId === invite.id ? t('revoking') : t('revokeInvite')}
                </Button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
