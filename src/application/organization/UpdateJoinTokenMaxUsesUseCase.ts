/** Join-link application boundary validates external values before invoking
 * domain behavior and typed authorization/persistence ports. */
import { JoinTokenMaxUses } from '../../domain/organization/JoinTokenValues';
import { JoinTokenDomainCodes } from '../../domain/organization/JoinTokenDomainCodes';

import { UserId } from '../../domain/shared/EntityIds';
import { JoinTokenId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { JoinTokenErrors, JoinTokenUseCaseFailure } from './JoinTokenErrors';
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
    rawActorUserId: string
  ): Promise<Result<void, JoinTokenUseCaseFailure>> {
    const parsedActorUserId = UserId.safeParse(rawActorUserId);

    if (!parsedActorUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const actorUserId = parsedActorUserId.data;
    const parsedTokenId = JoinTokenId.safeParse(input.tokenId);

    if (!parsedTokenId.success) {
      return failure(JoinTokenErrors.NOT_FOUND);
    }

    const command = { ...input, tokenId: parsedTokenId.data };

    // 1. Find token
    const token = await this.deps.joinTokenRepository.findById(command.tokenId);

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
    const parsedMaxUses = JoinTokenMaxUses.nullable().safeParse(
      command.maxUses
    );

    if (!parsedMaxUses.success) {
      return failure(JoinTokenDomainCodes.MAX_USES_INVALID);
    }

    const updateResult = token.updateMaxUses(parsedMaxUses.data);

    if (!updateResult.success) {
      return failure(updateResult.error);
    }

    // 4. Persist
    await this.deps.joinTokenRepository.update(token);

    return success(undefined);
  }
}
