/** Revokes a validated session identity through the session persistence port. */
/** Ends a session identified by a validated cookie token. */
import { SessionId } from '@/domain/shared/EntityIds';

import { SessionRepository } from '@/domain/user/SessionRepository';
import { Result, success } from '@/domain/shared/Result';

export class LogoutUserUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: SessionId): Promise<Result<void, never>> {
    await this.sessionRepository.delete(sessionId);

    return success(undefined);
  }
}
