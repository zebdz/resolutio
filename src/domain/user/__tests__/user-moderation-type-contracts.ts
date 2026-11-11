/** Moderation clients cannot substitute user IDs, historical text or incomplete block states. */
import { UserId } from '../../shared/EntityIds';
import type { UserRepository } from '../UserRepository';
import {
  UserBlockEntryId,
  UserModerationReasonSnapshot,
  type UserModerationReason,
  type UserBlockStatus,
  type UserModerationHistory,
} from '../UserModeration';
import type { UserBlockStatusView } from '@/web/actions/superadmin/suspiciousActivity';
const userId = UserId.parse('same-id');
const entryId = UserBlockEntryId.parse('same-id');
// @ts-expect-error Audit entry identities are not user identities.
const wrongEntry: UserBlockEntryId = userId;
// @ts-expect-error User identities are not audit entry identities.
const wrongUser: UserId = entryId;
// @ts-expect-error Historical snapshots cannot bypass new-reason validation.
const legacyAsReason: UserModerationReason =
  UserModerationReasonSnapshot.parse('');
// @ts-expect-error Raw strings must be validated before becoming a moderation reason.
const rawReason: UserModerationReason = 'Spam';
// @ts-expect-error Active blocks require a validated timestamp.
const undatedBlock: UserBlockStatus = { blocked: true };
// @ts-expect-error Client active-block views also require a timestamp.
const undatedView: UserBlockStatusView = { blocked: true };
// @ts-expect-error Moderation history status is a closed alternative.
const unknownStatus: UserModerationHistory['status'] = 'unknown';
declare const legacyUsers: UserRepository;
// @ts-expect-error Moderation reads must use the checked, Result-based moderation port.
const legacyBlockedRead = legacyUsers.isUserBlocked;
// @ts-expect-error Generic user persistence cannot bypass explicit moderation entries.
const legacyBlockedWrite = legacyUsers.blockUser;
