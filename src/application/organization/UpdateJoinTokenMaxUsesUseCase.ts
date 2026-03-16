import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinTokenErrors } from './JoinTokenErrors';
import { OrganizationErrors } from './OrganizationErrors';
import { UpdateJoinTokenMaxUsesInput } from './UpdateJoinTokenMaxUsesSchema';

export interface UpdateJoinTokenMaxUsesDependencies {
  joinTokenRepository: JoinTokenRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
}

export class UpdateJoinTokenMaxUsesUseCase {
  constructor(private deps: UpdateJoinTokenMaxUsesDependencies) {}

  async execute(
    input: UpdateJoinTokenMaxUsesInput,
    actorUserId: string
  ): Promise<Result<void, string>> {
    // 1. Find token
    const token = await this.deps.joinTokenRepository.findById(input.tokenId);

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

    // 3. Update max uses
    const updateResult = token.updateMaxUses(input.maxUses);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    // 4. Persist
    await this.deps.joinTokenRepository.update(token);

    return success(undefined);
  }
}
