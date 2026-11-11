/** Authorizes moderation and supplies identity/time before invoking domain validation.
 * Only validated audit entries reach the append-only port; persistence failures propagate. */
import { UserId } from '@/domain/shared/EntityIds';
import { failure, type Result } from '@/domain/shared/Result';
import {
  createUserModerationEntry,
  UserBlockEntryId,
  type UserModerationFailure,
} from '@/domain/user/UserModeration';
import type {
  UserModerationRepository,
  UserModerationStorageError,
} from '@/domain/user/UserModerationRepository';
import type { UserRepository } from '@/domain/user/UserRepository';
import type { ProfanityChecker } from '@/domain/shared/profanity/ProfanityChecker';
import {
  entityCreation,
  type Clock,
  type IdGenerator,
} from '../shared/EntityCreation';

export class ModerateUserUseCase {
  constructor(
    private readonly deps: {
      userRepository: Pick<UserRepository, 'isSuperAdmin'>;
      moderationRepository: Pick<UserModerationRepository, 'append'>;
      ids: IdGenerator;
      clock: Clock;
      profanityChecker: ProfanityChecker;
    }
  ) {}
  async execute(input: {
    userId: unknown;
    actorId: unknown;
    status: unknown;
    reason: unknown;
  }): Promise<
    Result<
      void,
      | UserModerationFailure
      | UserModerationStorageError
      | 'common.errors.unauthorized'
    >
  > {
    const userId = UserId.safeParse(input.userId);
    const actorId = UserId.safeParse(input.actorId);

    if (!userId.success || !actorId.success) {
      return failure('common.errors.validationFailed');
    }

    if (!(await this.deps.userRepository.isSuperAdmin(actorId.data))) {
      return failure('common.errors.unauthorized');
    }

    const entry = createUserModerationEntry(
      { ...input, userId: userId.data, actorId: actorId.data },
      entityCreation(UserBlockEntryId, this.deps.ids, this.deps.clock),
      this.deps.profanityChecker
    );

    if (!entry.success) {
      return entry;
    }

    return this.deps.moderationRepository.append(entry.value);
  }
}
