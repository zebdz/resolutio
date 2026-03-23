'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/src/web/components/catalyst/badge';
import { Button } from '@/src/web/components/catalyst/button';
import { Heading } from '@/src/web/components/catalyst/heading';
import { Text } from '@/src/web/components/catalyst/text';
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

  const BADGE_COLOR: Record<string, 'purple' | 'blue' | 'lime'> = {
    admin_invite: 'purple',
    board_member_invite: 'blue',
    member_invite: 'lime',
  };

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {invites.map((invite) => {
        const loading = loadingState[invite.id];
        const isLoading = !!loading;
        const titleKey = TYPE_TITLE_KEY[invite.type] || 'title';

        return (
          <div
            key={invite.id}
            className="flex flex-col rounded-lg border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <div className="flex items-start justify-between">
              <Heading level={3} className="text-lg font-semibold">
                {invite.organizationName}
              </Heading>
              <Badge color={BADGE_COLOR[invite.type] || 'lime'}>
                {t(titleKey as any)}
              </Badge>
            </div>

            {invite.boardName && (
              <Text className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {t('board')}: {invite.boardName}
              </Text>
            )}

            <Text className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
              {t('from')}: {invite.inviterName}
            </Text>

            <Text className="mt-auto pt-4 text-xs text-zinc-500 dark:text-zinc-500">
              {t('sentAt')}: {new Date(invite.createdAt).toLocaleDateString()}
            </Text>

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
