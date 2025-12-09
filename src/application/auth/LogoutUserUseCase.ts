import { SessionRepository } from '@/domain/user/SessionRepository';
import { Result, success, failure } from '@/domain/shared/Result';

export class LogoutUserUseCase {
  constructor(private readonly sessionRepository: SessionRepository) {}

  async execute(sessionId: string): Promise<Result<void, Error>> {
    try {
      await this.sessionRepository.delete(sessionId);

      return success(undefined);
    } catch (error) {
      return failure(error as Error);
    }
  }
}
