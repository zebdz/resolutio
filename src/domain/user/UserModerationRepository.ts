/** Moderation persistence appends audit entries and exposes validated status/history projections.
 * Expected storage failures remain explicit, distinct from an absent status. */
import type { UserId } from '../shared/EntityIds';
import type { Result } from '../shared/Result';
import type {
  UserBlockStatus,
  UserModerationEntry,
  UserModerationHistory,
} from './UserModeration';
export type UserModerationStorageError = 'common.errors.unexpected';
export interface UserModerationRepository {
  append(
    entry: UserModerationEntry
  ): Promise<Result<void, UserModerationStorageError>>;
  getStatus(
    userId: UserId
  ): Promise<Result<UserBlockStatus | null, UserModerationStorageError>>;
  getHistory(
    userId: UserId
  ): Promise<Result<UserModerationHistory[], UserModerationStorageError>>;
  getStatuses(
    userIds: readonly UserId[]
  ): Promise<
    Result<ReadonlyMap<UserId, UserBlockStatus>, UserModerationStorageError>
  >;
  getBlockedUserIds(): Promise<Result<UserId[], UserModerationStorageError>>;
}
