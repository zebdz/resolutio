import { JoinToken } from '../../domain/organization/JoinToken';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinOrganizationUseCase } from './JoinOrganizationUseCase';
import { JoinTokenErrors } from './JoinTokenErrors';
import { OrganizationErrors } from './OrganizationErrors';
import { Result, success, failure } from '../../domain/shared/Result';

export interface UseJoinTokenDependencies {
  joinTokenRepository: JoinTokenRepository;
  organizationRepository: OrganizationRepository;
  joinOrganizationUseCase: JoinOrganizationUseCase;
}

export class UseJoinTokenUseCase {
  constructor(private deps: UseJoinTokenDependencies) {}

  async execute(
    tokenValue: string,
    userId: string
  ): Promise<Result<{ organizationId: string }, string>> {
    // 1. Find token by value
    const token = await this.deps.joinTokenRepository.findByToken(tokenValue);

    if (!token) {
      return failure(JoinTokenErrors.NOT_FOUND);
    }

    // 2. Check if expired
    if (token.expiredAt !== null) {
      return failure(JoinTokenErrors.EXPIRED);
    }

    // 3. Find org, check exists + not archived
    const org = await this.deps.organizationRepository.findById(
      token.organizationId
    );

    if (!org) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    if (org.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // 4. Race-safe increment
    const incremented =
      await this.deps.joinTokenRepository.tryIncrementUseCount(token.id);

    if (!incremented) {
      return failure(JoinTokenErrors.EXHAUSTED);
    }

    // 5. Delegate to JoinOrganizationUseCase
    const joinResult = await this.deps.joinOrganizationUseCase.execute(
      { organizationId: token.organizationId, joinTokenId: token.id },
      userId
    );

    // 6. If join fails, best-effort rollback useCount
    if (!joinResult.success) {
      try {
        const current = await this.deps.joinTokenRepository.findById(token.id);

        if (current && current.useCount > 0) {
          const decremented = JoinToken.reconstitute({
            ...current.toJSON(),
            useCount: current.useCount - 1,
          });
          await this.deps.joinTokenRepository.update(decremented);
        }
      } catch {
        // Swallow rollback errors
      }

      return failure(joinResult.error);
    }

    // 7. Success
    return success({ organizationId: token.organizationId });
  }
}
