import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';

export interface ListClaimableAssetsInput {
  userId: string;
  organizationId: string;
  propertyId: string;
}

export interface ClaimableAssetView {
  id: string;
  name: string;
}

export interface ListClaimableAssetsDependencies {
  propertyRepository: OrganizationPropertyRepository;
  assetRepository: PropertyAssetRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  // Used to filter assets the calling user already has a PENDING claim on
  // — they would just bounce off the ALREADY_PENDING_FOR_ASSET guard in
  // SubmitPropertyClaim, so don't show them the button.
  claimRepository: PropertyClaimRepository;
}

export class ListClaimableAssetsUseCase {
  constructor(private deps: ListClaimableAssetsDependencies) {}

  async execute(
    input: ListClaimableAssetsInput
  ): Promise<Result<ClaimableAssetView[], string>> {
    const [isMember, isSuper] = await Promise.all([
      this.deps.organizationRepository.isUserMember(
        input.userId,
        input.organizationId
      ),
      this.deps.userRepository.isSuperAdmin(input.userId),
    ]);

    if (!(isMember || isSuper)) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const pRes = await this.deps.propertyRepository.findById(input.propertyId);

    if (!pRes.success) {
      return failure(pRes.error);
    }

    if (!pRes.value || pRes.value.organizationId !== input.organizationId) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    if (pRes.value.isArchived()) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }

    const assets = await this.deps.assetRepository.findClaimableAssets(
      input.propertyId
    );

    if (!assets.success) {
      return failure(assets.error);
    }

    // Filter out assets the calling user already has a PENDING claim on.
    // The backend would reject a second submission with ALREADY_PENDING_FOR_ASSET;
    // hiding the asset from the picker prevents the dead-end click.
    const myClaimsRes = await this.deps.claimRepository.findMyClaimsForProperty(
      input.userId,
      input.propertyId
    );

    if (!myClaimsRes.success) {
      return failure(myClaimsRes.error);
    }

    const myPendingAssetIds = new Set(
      myClaimsRes.value
        .filter((c) => c.claim.status === 'PENDING')
        .map((c) => c.claim.assetId)
    );

    // Re-project explicitly, ignoring any extra fields that might appear later.
    return success(
      assets.value
        .filter((a) => !myPendingAssetIds.has(a.id))
        .map((a) => ({ id: a.id, name: a.name }))
    );
  }
}
