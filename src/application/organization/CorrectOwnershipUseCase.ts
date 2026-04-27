import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { PropertyLockRepository } from '../../domain/organization/PropertyLockRepository';
import { PropertyLockService } from '../../domain/organization/PropertyLockService';
import { ProfanityChecker } from '../../domain/shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../../domain/shared/SharedDomainCodes';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationErrors } from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface CorrectOwnershipInput {
  ownershipId: string;
  newShare: number;
  reason: string;
  adminUserId: string;
}

export interface CorrectOwnershipDependencies {
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  lockRepository: PropertyLockRepository;
  profanityChecker: ProfanityChecker;
}

const SUM_TOLERANCE = 1e-6;

export class CorrectOwnershipUseCase {
  private lockService = new PropertyLockService();

  constructor(private deps: CorrectOwnershipDependencies) {}

  async execute(input: CorrectOwnershipInput): Promise<Result<void, string>> {
    const reason = (input.reason ?? '').trim();

    if (reason.length === 0) {
      return failure(OrganizationDomainCodes.CORRECTION_REASON_EMPTY);
    }

    if (this.deps.profanityChecker.containsProfanity(reason)) {
      return failure(SharedDomainCodes.CONTAINS_PROFANITY);
    }

    const oRes = await this.deps.assetRepository.findOwnershipById(
      input.ownershipId
    );

    if (!oRes.success) {
      return failure(oRes.error);
    }

    if (!oRes.value) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_FOUND);
    }

    const ownership = oRes.value;

    if (!ownership.isActive()) {
      return failure(OrganizationDomainCodes.OWNERSHIP_ROW_NOT_ACTIVE);
    }

    const aRes = await this.deps.assetRepository.findAssetById(
      ownership.assetId
    );

    if (!aRes.success || !aRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_NOT_FOUND);
    }

    const asset = aRes.value;
    const pRes = await this.deps.propertyRepository.findById(asset.propertyId);

    if (!pRes.success || !pRes.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const property = pRes.value;

    if (!(await this.authorize(input.adminUserId, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    // Block corrections on archived assets/properties — same reasoning as
    // ReplaceAssetOwnersUseCase: archived state is for read/restore only.
    if (property.isArchived()) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }

    if (asset.isArchived()) {
      return failure(OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED);
    }

    // Property-scoped lock query covers cross-tree locks (parent-org polls with
    // empty scope implicitly include descendant properties).
    const facts = await this.deps.lockRepository.findSnapshotFactsForProperty(
      property.id
    );

    if (!facts.success) {
      return failure(facts.error);
    }

    if (this.lockService.isLocked(property.id, facts.value)) {
      return failure(OrganizationDomainCodes.CANNOT_CORRECT_LOCKED_PROPERTY);
    }

    // Entity-level range check.
    const correction = ownership.correct(input.newShare);

    if (!correction.success) {
      return failure(correction.error);
    }

    // Re-check sum across all active rows (with the new share substituted).
    const active = await this.deps.assetRepository.findActiveOwnershipForAsset(
      asset.id
    );

    if (!active.success) {
      return failure(active.error);
    }

    const sum = active.value.reduce(
      (s, r) => s + (r.id === ownership.id ? input.newShare : r.share),
      0
    );

    if (Math.abs(sum - 1) > SUM_TOLERANCE) {
      return failure(OrganizationDomainCodes.SHARES_DO_NOT_SUM_TO_ONE);
    }

    return this.deps.assetRepository.correctOwnership({
      ownershipId: ownership.id,
      newShare: input.newShare,
    });
  }

  private async authorize(userId: string, orgId: string): Promise<boolean> {
    if (await this.deps.userRepository.isSuperAdmin(userId)) {
      return true;
    }

    return this.deps.organizationRepository.isUserAdmin(userId, orgId);
  }
}
