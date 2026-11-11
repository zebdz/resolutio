/** Application boundary validates raw requests before invoking property/claim
 * behavior, and supplies explicit identity/time through injected dependencies. */
import { OrganizationUseCaseFailure } from './OrganizationErrors';
import {
  OrganizationId,
  PropertyId,
  UserId,
  AssetId,
} from '../../domain/shared/EntityIds';
import { AssetName } from '../../domain/organization/PropertyValues';
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
  id: AssetId;
  name: AssetName;
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
  ): Promise<Result<ClaimableAssetView[], OrganizationUseCaseFailure>> {
    const organizationId = OrganizationId.safeParse(input.organizationId);

    if (!organizationId.success) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const userId = UserId.safeParse(input.userId);

    if (!userId.success) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const propertyId = PropertyId.safeParse(input.propertyId);

    if (!propertyId.success) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const [isMember, isSuper] = await Promise.all([
      this.deps.organizationRepository.isUserMember(
        userId.data,
        organizationId.data
      ),
      this.deps.userRepository.isSuperAdmin(userId.data),
    ]);

    if (!(isMember || isSuper)) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const pRes = await this.deps.propertyRepository.findById(propertyId.data);

    if (!pRes.success) {
      return failure(pRes.error);
    }

    if (!pRes.value || pRes.value.organizationId !== organizationId.data) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    if (pRes.value.isArchived()) {
      return failure(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
    }

    const assets = await this.deps.assetRepository.findClaimableAssets(
      propertyId.data
    );

    if (!assets.success) {
      return failure(assets.error);
    }

    // Filter out assets the calling user already has a PENDING claim on.
    // The backend would reject a second submission with ALREADY_PENDING_FOR_ASSET;
    // hiding the asset from the picker prevents the dead-end click.
    const myClaimsRes = await this.deps.claimRepository.findMyClaimsForProperty(
      userId.data,
      propertyId.data
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
