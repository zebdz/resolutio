/** Join-link application boundary validates external values before invoking
 * domain behavior and typed authorization/persistence ports. */
import { JoinTokenValue } from '../../domain/organization/JoinTokenValues';
import { UserId } from '../../domain/shared/EntityIds';
import { OrganizationId } from '../../domain/shared/EntityIds';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { JoinOrganizationUseCase } from './JoinOrganizationUseCase';
import { JoinTokenErrors, JoinTokenUseCaseFailure } from './JoinTokenErrors';
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
    rawTokenValue: string,
    rawUserId: string
  ): Promise<
    Result<{ organizationId: OrganizationId }, JoinTokenUseCaseFailure>
  > {
    const parsedTokenValue = JoinTokenValue.safeParse(rawTokenValue);

    if (!parsedTokenValue.success) {
      return failure(JoinTokenErrors.NOT_FOUND);
    }

    const tokenValue = parsedTokenValue.data;
    const parsedUserId = UserId.safeParse(rawUserId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const userId = parsedUserId.data;

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
          current.releaseUse();
          await this.deps.joinTokenRepository.update(current);
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
