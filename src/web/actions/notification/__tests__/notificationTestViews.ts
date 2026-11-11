/** Valid examples for every notification kind, decoded with public domain schemas.
 * Historical labels stay exact; these fixtures exercise the transport/navigation boundary. */
import { NotificationContent } from '@/domain/notification/NotificationContent';
import { NotificationId, UserId } from '@/domain/shared/EntityIds';
import type { NotificationSnapshot } from '@/domain/notification/Notification';

export const notificationSamples = NotificationContent.options.map(
  (schema): NotificationSnapshot => {
    const kind = schema.unwrap().shape.type.value;
    const key = kind.replace(/_([a-z])/g, (_, letter: string) =>
      letter.toUpperCase()
    );

    return {
      ...schema.parse({
        type: kind,
        title: `notification.types.${key}.title`,
        body: `notification.types.${key}.body`,
        data: {
          organizationId: 'org-1',
          organizationName: ' Organization ',
          inviterName: 'Inviter',
          inviteeName: 'Invitee',
          actorName: 'Actor',
          invitationId: 'invite-1',
          inviteType: 'member_invite',
          boardId: 'board-1',
          boardName: 'Board',
          childOrgId: 'child-1',
          parentOrgId: 'parent-1',
          childOrgName: 'Child',
          parentOrgName: 'Parent',
          rejectionReason: '',
          requesterName: 'Requester',
          memberName: 'Member',
          allowed: false,
          oldName: 'Old',
          newName: 'New',
          pollId: 'poll-1',
          pollTitle: ' Poll ',
          claimId: 'claim-1',
          assetId: 'asset-1',
          reason: null,
          reportId: 'report-1',
          title: 'Report',
        },
      }),
      id: NotificationId.parse(`notification-${kind}`),
      userId: UserId.parse('user-1'),
      readAt: null,
      createdAt: new Date('2026-11-04T12:00:00.000Z'),
    };
  }
);
