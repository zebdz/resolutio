import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';

export interface DenyPropertyClaimInput {
  claimId: string;
  adminUserId: string;
  reason: string;
}

export interface DenyPropertyClaimDependencies {
  claimRepository: PropertyClaimRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  profanityChecker: ProfanityChecker;
  notifyDenied: NotifyPropertyClaimDeniedUseCase;
}

export class DenyPropertyClaimUseCase {
  constructor(private deps: DenyPropertyClaimDependencies) {}

  async execute(input: DenyPropertyClaimInput): Promise<Result<void, string>> {
    const cRes = await this.deps.claimRepository.findById(input.claimId);

    if (!cRes.success) {
      return failure(cRes.error);
    }

    if (!cRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_CLAIM_NOT_FOUND);
    }

    const claim = cRes.value;

    if (!(await this.authorize(input.adminUserId, claim.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const t = claim.deny(
      input.adminUserId,
      input.reason,
      new Date(),
      this.deps.profanityChecker
    );

    if (!t.success) {
      return failure(t.error);
    }

    const saved = await this.deps.claimRepository.update(claim);

    if (!saved.success) {
      return failure(saved.error);
    }

    await this.deps.notifyDenied.execute({ claimId: claim.id });

    return success(undefined);
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
