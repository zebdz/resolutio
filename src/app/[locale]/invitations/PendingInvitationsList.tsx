'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/app/components/catalyst/button';
import { Heading } from '@/app/components/catalyst/heading';
import { Text } from '@/app/components/catalyst/text';
import { handleInviteAction } from '@/web/actions/invitation';
import { toast } from 'sonner';
import type { InviteDetails } from '@/application/invitation/GetInviteDetailsUseCase';

const TYPE_TITLE_KEY: Record<string, string> = {
  admin_invite: 'adminInvite',
  board_member_invite: 'boardMemberInvite',
  member_invite: 'memberInvite',
};

interface PendingInvitationsListProps {
  initialInvites: InviteDetails[];
}

export function PendingInvitationsList({
  initialInvites,
}: PendingInvitationsListProps) {
  const t = useTranslations('invitation.page');
  const tList = useTranslations('invitation');
  const tErrors = useTranslations('common.errors');
  const [invites, setInvites] = useState(initialInvites);
  const [loadingState, setLoadingState] = useState<
    Record<string, 'accepting' | 'declining' | null>
  >({});

  const handleAction = async (
    invitationId: string,
    action: 'accept' | 'decline'
  ) => {
    setLoadingState((prev) => ({
      ...prev,
      [invitationId]: action === 'accept' ? 'accepting' : 'declining',
    }));

    try {
      const result = await handleInviteAction(invitationId, action);

      if (result.success) {
        toast.success(action === 'accept' ? t('accepted') : t('declined'));
        setInvites((prev) => prev.filter((inv) => inv.id !== invitationId));
      } else {
        toast.error(result.error);
      }
    } catch {
      toast.error(tErrors('unexpected'));
    } finally {
      setLoadingState((prev) => ({
        ...prev,
        [invitationId]: null,
      }));
    }
  };

  if (invites.length === 0) {
    return (
      <Text className="text-zinc-500 dark:text-zinc-400">
        {tList('noInvitations')}
      </Text>
    );
  }

  return (
    <div className="space-y-4">
      {invites.map((invite) => {
        const loading = loadingState[invite.id];
        const isLoading = !!loading;
        const titleKey = TYPE_TITLE_KEY[invite.type] || 'title';

        return (
          <div
            key={invite.id}
            className="rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <Heading className="mb-4 text-xl font-bold">
              {t(titleKey as any)}
            </Heading>

            <dl className="space-y-3">
              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('organization')}
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {invite.organizationName}
                </dd>
              </div>

              {invite.boardName && (
                <div>
                  <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                    {t('board')}
                  </dt>
                  <dd className="text-zinc-900 dark:text-zinc-100">
                    {invite.boardName}
                  </dd>
                </div>
              )}

              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('from')}
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {invite.inviterName}
                </dd>
              </div>

              <div>
                <dt className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {t('sentAt')}
                </dt>
                <dd className="text-zinc-900 dark:text-zinc-100">
                  {new Date(invite.createdAt).toLocaleDateString()}
                </dd>
              </div>
            </dl>

            <div className="mt-4 flex gap-3">
              <Button
                color="brand-green"
                onClick={() => handleAction(invite.id, 'accept')}
                disabled={isLoading}
              >
                {loading === 'accepting' ? t('accepting') : t('accept')}
              </Button>
              <Button
                color="red"
                onClick={() => handleAction(invite.id, 'decline')}
                disabled={isLoading}
              >
                {loading === 'declining' ? t('declining') : t('decline')}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
