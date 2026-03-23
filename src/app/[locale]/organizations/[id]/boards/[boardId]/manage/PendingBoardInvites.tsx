'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { Button } from '@/src/web/components/catalyst/button';
import { revokeInviteAction } from '@/web/actions/invitation';

type PendingInvite = {
  id: string;
  inviteeName: string;
};

type PendingBoardInvitesProps = {
  invites: PendingInvite[];
};

export default function PendingBoardInvites({
  invites,
}: PendingBoardInvitesProps) {
  const t = useTranslations('organization.boards.manageSingle');
  const router = useRouter();
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleRevoke = async (invitationId: string) => {
    setRevokingId(invitationId);
    setError(null);

    const result = await revokeInviteAction(invitationId);

    if (result.success) {
      setRevokingId(null);
      router.refresh();
    } else {
      setError(result.error);
      setRevokingId(null);
    }
  };

  if (invites.length === 0) {
    return (
      <div className="text-sm text-zinc-500 dark:text-zinc-400">
        {t('noInvites')}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {invites.map((invite) => (
          <div
            key={invite.id}
            className="flex flex-col gap-2 rounded-lg border border-zinc-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="min-w-0">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">
                {invite.inviteeName}
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
        ))}
      </div>
      {error && (
        <div className="mt-2 text-sm text-red-600 dark:text-red-400">
          {error}
        </div>
      )}
    </>
  );
}
