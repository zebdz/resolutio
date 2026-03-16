import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinTokenErrors } from './JoinTokenErrors';
import { OrganizationErrors } from './OrganizationErrors';

export interface ExpireJoinTokenDependencies {
  joinTokenRepository: JoinTokenRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class ExpireJoinTokenUseCase {
  constructor(private deps: ExpireJoinTokenDependencies) {}

  async execute(
    tokenId: string,
    actorUserId: string
  ): Promise<Result<void, string>> {
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

    // 3. Expire
    const expireResult = token.expire();

    if (!expireResult.success) {
      return failure(expireResult.error);
    }

    // 4. Update
    await this.deps.joinTokenRepository.update(token);

    return success(undefined);
  }
}
