/** Loads moderation state before applying the domain's authenticated-access policy.
 * Explicit storage failures propagate instead of defaulting to permission. */
import type { UserId } from '@/domain/shared/EntityIds';
import { success, type Result } from '@/domain/shared/Result';
import {
  userModerationAccess,
  type UserModerationAccess,
} from '@/domain/user/UserModeration';
import type {
  UserModerationRepository,
  UserModerationStorageError,
} from '@/domain/user/UserModerationRepository';

export async function getUserModerationAccess(
  repository: Pick<UserModerationRepository, 'getStatus'>,
  userId: UserId
): Promise<Result<UserModerationAccess, UserModerationStorageError>> {
  const status = await repository.getStatus(userId);

  if (!status.success) {
    return status;
  }

  return success(userModerationAccess(status.value));
}
