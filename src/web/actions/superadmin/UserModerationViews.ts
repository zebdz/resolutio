/** Moderation transport projections preserve the closed block state and legacy reason text.
 * Admin readers retain Date or canonical ISO formats without exposing domain instances. */
import type {
  UserBlockStatus,
  UserModerationReasonSnapshot,
} from '@/domain/user/UserModeration';
import { Instant } from '@/domain/shared/Instant';
export type UserBlockStatusView =
  | { blocked: false }
  | { blocked: true; reason?: UserModerationReasonSnapshot; blockedAt: Date };
export type SerializedUserBlockStatusView =
  | { blocked: false }
  | {
      blocked: true;
      reason?: UserModerationReasonSnapshot;
      blockedAt: Instant;
    };

export function serializeUserBlockStatus(
  status: UserBlockStatus | null
): UserBlockStatusView | null {
  if (status === null) {
    return null;
  }

  return status.blocked
    ? {
        blocked: true,
        reason: status.reason,
        blockedAt: Instant.toDate(status.blockedAt),
      }
    : { blocked: false };
}

export function serializeUserBlockStatusIso(
  status: UserBlockStatus | null
): SerializedUserBlockStatusView | null {
  if (status === null) {
    return null;
  }

  return status.blocked
    ? { blocked: true, reason: status.reason, blockedAt: status.blockedAt }
    : { blocked: false };
}
