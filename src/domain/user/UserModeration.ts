/** Immutable append-only user moderation records retain validated identities and exact reasons.
 * Historical reason snapshots preserve legacy text; new decisions require a nonblank reason. */
import { z } from 'zod';
import { identifier } from '../shared/Identifier';
import { UserId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import type { EntityCreation } from '../shared/EntityCreation';
import type { ProfanityChecker } from '../shared/profanity/ProfanityChecker';
import { failure, success, type Result } from '../shared/Result';
import type { FirstName, LastName, MiddleName } from './UserValues';

export const UserBlockEntryId = identifier(
  'UserBlockEntryId',
  /^[A-Za-z0-9_-]{1,256}$/
);
export type UserBlockEntryId = z.infer<typeof UserBlockEntryId>;
export const UserModerationStatus = z.enum(['blocked', 'unblocked']);
export type UserModerationStatus = z.infer<typeof UserModerationStatus>;
export const UserModerationReason = z
  .string()
  .refine((value) => value.trim().length > 0)
  .brand<'UserModerationReason'>();
export type UserModerationReason = z.infer<typeof UserModerationReason>;
export const UserModerationReasonSnapshot = z
  .string()
  .brand<'UserModerationReasonSnapshot'>();
export type UserModerationReasonSnapshot = z.infer<
  typeof UserModerationReasonSnapshot
>;
export const UserModerationEntry = z
  .object({
    id: UserBlockEntryId,
    userId: UserId,
    actorId: UserId,
    status: UserModerationStatus,
    reason: UserModerationReason,
    createdAt: Instant.schema,
  })
  .readonly();
export type UserModerationEntry = z.infer<typeof UserModerationEntry>;
export type UserModerationFailure =
  | 'common.errors.validationFailed'
  | 'superadmin.users.reasonRequired'
  | 'domain.shared.containsProfanity';
export type UserBlockStatus =
  | {
      readonly blocked: true;
      readonly reason?: UserModerationReasonSnapshot;
      readonly blockedAt: Instant;
    }
  | { readonly blocked: false };
export type UserModerationAccess = 'allowed' | 'blocked';

export function userModerationAccess(
  status: UserBlockStatus | null
): UserModerationAccess {
  return status?.blocked ? 'blocked' : 'allowed';
}

export interface UserModerationHistory {
  readonly id: UserBlockEntryId;
  readonly status: UserModerationStatus;
  readonly reason: UserModerationReasonSnapshot | null;
  readonly createdAt: Instant;
  readonly statusChangedBy: {
    readonly firstName: FirstName;
    readonly lastName: LastName;
    readonly middleName: MiddleName | null;
  };
}

export function createUserModerationEntry(
  input: {
    userId: unknown;
    actorId: unknown;
    status: unknown;
    reason: unknown;
  },
  creation: EntityCreation<UserBlockEntryId>,
  checker?: ProfanityChecker
): Result<UserModerationEntry, UserModerationFailure> {
  const reason = UserModerationReason.safeParse(input.reason);

  if (!reason.success) {
    return failure('superadmin.users.reasonRequired');
  }

  if (checker?.containsProfanity(reason.data)) {
    return failure('domain.shared.containsProfanity');
  }

  const parsed = UserModerationEntry.safeParse({
    ...input,
    reason: reason.data,
    id: creation.id,
    createdAt: creation.now,
  });

  return parsed.success
    ? success(parsed.data)
    : failure('common.errors.validationFailed');
}
