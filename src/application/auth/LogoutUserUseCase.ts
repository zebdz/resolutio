import { SessionRepository } from '@/domain/user/SessionRepository';
import { Result, success } from '@/domain/shared/Result';

export class LogoutUserUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: string): Promise<Result<void, string>> {
    await this.sessionRepository.delete(sessionId);

    return success(undefined);
  }
}
