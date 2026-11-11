/** Join-link application boundary validates external values before invoking
 * domain behavior and typed authorization/persistence ports. */
import { JoinTokenId } from '../../domain/shared/EntityIds';
import { UserId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinTokenErrors, JoinTokenUseCaseFailure } from './JoinTokenErrors';
import { OrganizationErrors } from './OrganizationErrors';

export interface ReactivateJoinTokenDependencies {
  joinTokenRepository: JoinTokenRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ReactivateJoinTokenUseCase {
  constructor(private deps: ReactivateJoinTokenDependencies) {}

  async execute(
    rawTokenId: string,
    rawActorUserId: string
  ): Promise<Result<void, JoinTokenUseCaseFailure>> {
    const parsedTokenId = JoinTokenId.safeParse(rawTokenId);

    if (!parsedTokenId.success) {
      return failure(JoinTokenErrors.NOT_FOUND);
    }

    const tokenId = parsedTokenId.data;
    const parsedActorUserId = UserId.safeParse(rawActorUserId);

    if (!parsedActorUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const actorUserId = parsedActorUserId.data;

    // 1. Find token
    const token = await this.deps.joinTokenRepository.findById(tokenId);

    if (!token) {
      return failure(JoinTokenErrors.NOT_FOUND);
    }

    // 2. Check actor is admin/superadmin of token's org
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        token.organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 3. Reactivate
    const reactivateResult = token.reactivate();

    if (!reactivateResult.success) {
      return failure(reactivateResult.error);
    }

    // 4. Update
    await this.deps.joinTokenRepository.update(token);

    return success(undefined);
  }
}
