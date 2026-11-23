/** Compile-only clients prove entity identities, content alternatives and quota units stay distinct. */
import {
  BoardId,
  UserId,
  OrganizationId,
  PollId,
  InvitationId,
} from '../../shared/EntityIds';
import { EntityCreation } from '../../shared/EntityCreation';
import { Instant } from '../../shared/Instant';
import { Invitation, InvitationTarget } from '../../invitation/Invitation';
import { NotificationContent, NotificationCount } from '../NotificationContent';
import { Notification } from '../Notification';
import { GetNotificationsResult } from '@/application/notification/GetNotificationsUseCase';
import { GetUnreadNotificationCountUseCase } from '@/application/notification/GetUnreadNotificationCountUseCase';
import { NotificationRepository } from '../NotificationRepository';
import {
  AIModelKey,
  ProviderModelId,
  TokenCount,
  LegalIssueCount,
} from '../../ai/LegalAnalysis';
import { LegalCheckRepository } from '../../ai/LegalCheckRepository';
import {
  SystemSetting,
  DailyTokenCap,
  MinimumOrganizationSize,
} from '../../systemSetting/SystemSetting';
declare const userId: UserId,
  orgId: OrganizationId,
  pollId: PollId,
  boardId: BoardId,
  at: Instant;
declare const creation: EntityCreation<InvitationId>;
// @ts-expect-error Board membership requires its board identity.
const incompleteTarget: InvitationTarget = {
  type: 'board_member_invite',
  boardId: null,
};
// @ts-expect-error An organization invitation cannot carry a board target.
const wrongTarget: InvitationTarget = { type: 'admin_invite', boardId };
Invitation.create(
  orgId,
  // @ts-expect-error A board cannot stand in for the inviting user.
  boardId,
  userId,
  { type: 'admin_invite', boardId: null },
  creation
);
declare const notification: NotificationContent;
// @ts-expect-error Raw recipients must be decoded before repository calls.
(null! as NotificationRepository).findByUserId('raw-user');
// @ts-expect-error Notification read time must be validated.
(null! as NotificationRepository).markAllAsRead(userId, 'tomorrow');
const wrongPayload: NotificationContent = {
  type: 'poll_finished',
  title: 'notification.types.pollFinished.title',
  body: 'notification.types.pollFinished.body',
  // @ts-expect-error Notification kind fixes its payload fields and translation keys.
  data: { organizationId: orgId },
};
declare const providerId: ProviderModelId;
// @ts-expect-error Provider model versions and stable selection keys are different concepts.
const model: AIModelKey = providerId;
declare const issueCount: LegalIssueCount;
// @ts-expect-error Issue counts cannot substitute for provider token accounting.
const tokens: TokenCount = issueCount;
// @ts-expect-error Quota cutoffs are instants, not arbitrary millisecond numbers.
(null! as LegalCheckRepository).countRecentChecks(userId, 3600000);
declare const size: MinimumOrganizationSize;
// @ts-expect-error A membership size cannot configure the token cap.
const setting: SystemSetting = {
  key: 'legal_check_daily_token_cap',
  value: size,
};

declare const savedNotification: Notification;
const snapshot = savedNotification.toJSON();
const content: NotificationContent = snapshot;
const recipient: UserId = snapshot.userId;

if (snapshot.type === 'poll_finished') {
  const poll: PollId = snapshot.data.pollId;
}

// @ts-expect-error Application totals retain their validated count unit.
const rawTotal: GetNotificationsResult['totalCount'] = 3;
// @ts-expect-error Unread counts cannot be supplied as arbitrary numbers.
const rawUnread: GetNotificationsResult['unreadCount'] = 3;
declare const unreadResult: Awaited<
  ReturnType<GetUnreadNotificationCountUseCase['execute']>
>;

if (unreadResult.success) {
  const unread: NotificationCount = unreadResult.value.count;
}
