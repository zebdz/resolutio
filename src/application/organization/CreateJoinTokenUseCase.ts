/** Join-link application boundary validates external values before invoking domain behavior.
 * Creation results retain typed identities, generated token text and usage quantities. */
import { JoinTokenUseCaseFailure } from './JoinTokenErrors';
import { Clock, IdGenerator, entityCreation } from '../shared/EntityCreation';
import { JoinTokenGenerator } from './JoinTokenGenerator';
import { JoinTokenId } from '../../domain/shared/EntityIds';
import {
  JoinTokenMaxUses,
  parseJoinTokenDescription,
} from '../../domain/organization/JoinTokenValues';
import { JoinTokenDomainCodes } from '../../domain/organization/JoinTokenDomainCodes';

import { UserId } from '../../domain/shared/EntityIds';
import { OrganizationId } from '../../domain/shared/EntityIds';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { JoinTokenRepository } from '../../domain/organization/JoinTokenRepository';
import {
  JoinToken,
  JoinTokenSnapshot,
} from '../../domain/organization/JoinToken';
import { Result, success, failure } from '../../domain/shared/Result';
import { CreateJoinTokenInput } from './CreateJoinTokenSchema';
import { OrganizationErrors } from './OrganizationErrors';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';

export interface CreateJoinTokenDependencies {
  ids: IdGenerator;
  clock: Clock;
  tokens: JoinTokenGenerator;
  organizationRepository: OrganizationRepository;
  joinTokenRepository: JoinTokenRepository;
  userRepository: UserRepository;
  profanityChecker?: ProfanityChecker;
}

export class CreateJoinTokenUseCase {
  constructor(private deps: CreateJoinTokenDependencies) {}

  async execute(
    input: CreateJoinTokenInput,
    rawActorUserId: string
  ): Promise<Result<JoinTokenSnapshot, JoinTokenUseCaseFailure>> {
    const parsedActorUserId = UserId.safeParse(rawActorUserId);

    if (!parsedActorUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const actorUserId = parsedActorUserId.data;
    const parsedOrganizationId = OrganizationId.safeParse(input.organizationId);

    if (!parsedOrganizationId.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const command = { ...input, organizationId: parsedOrganizationId.data };

    const { organizationId, description, maxUses } = command;

    // 1. Find org
    const organization =
      await this.deps.organizationRepository.findById(organizationId);

    if (!organization) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    // 2. Check not archived
    if (organization.isArchived()) {
      return failure(OrganizationErrors.ARCHIVED);
    }

    // 3. Check actor is admin or superadmin
    const isSuperAdmin =
      await this.deps.userRepository.isSuperAdmin(actorUserId);

    if (!isSuperAdmin) {
      const isAdmin = await this.deps.organizationRepository.isUserAdmin(
        actorUserId,
        organizationId
      );

      if (!isAdmin) {
        return failure(OrganizationErrors.NOT_ADMIN);
      }
    }

    // 4. Create domain entity
    const parsedDescription = parseJoinTokenDescription(description);

    if (!parsedDescription.success) {
      return parsedDescription;
    }

    const parsedMaxUses = JoinTokenMaxUses.nullable().safeParse(
      maxUses ?? null
    );

    if (!parsedMaxUses.success) {
      return failure(JoinTokenDomainCodes.MAX_USES_INVALID);
    }

    const createResult = JoinToken.create(
      {
        organizationId,
        createdById: actorUserId,
        description: parsedDescription.value,
        maxUses: parsedMaxUses.data,
        token: this.deps.tokens.generate(),
      },
      entityCreation(JoinTokenId, this.deps.ids, this.deps.clock),
      this.deps.profanityChecker
    );

    if (!createResult.success) {
      return failure(createResult.error);
    }

    // 5. Save
    const saved = await this.deps.joinTokenRepository.save(createResult.value);

    return success(saved.toJSON());
  }
}
