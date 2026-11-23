/** Application boundary validates raw requests before invoking property/claim
 * behavior, and supplies explicit identity/time through injected dependencies. */
import {
  OrganizationId,
  PropertyClaimId,
  UserId,
} from '../../domain/shared/EntityIds';
import { ClaimDenialReason } from '../../domain/organization/PropertyValues';
import { Clock } from '../shared/EntityCreation';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';

export interface DenyPropertyClaimInput {
  claimId: string;
  adminUserId: string;
  reason: string;
}

export interface DenyPropertyClaimDependencies {
  clock: Clock;
  claimRepository: PropertyClaimRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
  notifyDenied: NotifyPropertyClaimDeniedUseCase;
}

export class DenyPropertyClaimUseCase {
  constructor(private deps: DenyPropertyClaimDependencies) {}

  async execute(
    input: DenyPropertyClaimInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const claimId = PropertyClaimId.safeParse(input.claimId);

    if (!claimId.success) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_FOUND);
    }

    const adminUserId = UserId.safeParse(input.adminUserId);

    if (!adminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const cRes = await this.deps.claimRepository.findById(claimId.data);

    if (!cRes.success) {
      return failure(cRes.error);
    }

    if (!cRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_FOUND);
    }

    const claim = cRes.value;

    if (!(await this.authorize(adminUserId.data, claim.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const reason = ClaimDenialReason.safeParse(input.reason);

    if (!reason.success) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_DENIAL_REASON_EMPTY
      );
    }

    const t = claim.deny(
      adminUserId.data,
      reason.data,
      this.deps.clock.now(),
      this.deps.profanityChecker
    );

    if (!t.success) {
      return failure(t.error);
    }

    const saved = await this.deps.claimRepository.update(claim);

    if (!saved.success) {
      return failure(saved.error);
    }

    const delivery = await this.deps.notifyDenied.execute({
      claimId: claim.id,
    });

    if (!delivery.success) {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }

  private async authorize(
    userId: UserId,
    orgId: OrganizationId
  ): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
