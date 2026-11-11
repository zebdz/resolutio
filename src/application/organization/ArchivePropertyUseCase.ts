/** Application boundary validates raw requests before invoking property/claim
 * behavior, and supplies explicit identity/time through injected dependencies. */
import {
  OrganizationId,
  PropertyId,
  UserId,
} from '../../domain/shared/EntityIds';
import { ClaimDenialReason } from '../../domain/organization/PropertyValues';
import { Clock } from '../shared/EntityCreation';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { AutoDenyPendingClaimsOnArchiveUseCase } from './AutoDenyPendingClaimsOnArchiveUseCase';

export interface ArchivePropertyInput {
  propertyId: string;
  adminUserId: string;
}

export interface ArchivePropertyDependencies {
  clock: Clock;
  propertyRepository: OrganizationPropertyRepository;
  assetRepository: PropertyAssetRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  autoDenyClaims: AutoDenyPendingClaimsOnArchiveUseCase;
}

export class ArchivePropertyUseCase {
  constructor(private deps: ArchivePropertyDependencies) {}

  async execute(
    input: ArchivePropertyInput
  ): Promise<Result<void, OrganizationUseCaseFailure>> {
    const propertyId = PropertyId.safeParse(input.propertyId);

    if (!propertyId.success) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const adminUserId = UserId.safeParse(input.adminUserId);

    if (!adminUserId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const found = await this.deps.propertyRepository.findById(propertyId.data);

    if (!found.success) {
      return failure(found.error);
    }

    if (!found.value) {
      return failure(OrganizationDomainCodes.PROPERTY_NOT_FOUND);
    }

    const property = found.value;

    if (!(await this.authorize(adminUserId.data, property.organizationId))) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const at = this.deps.clock.now();
    const arch = property.archive(at);

    if (!arch.success) {
      return failure(arch.error);
    }

    const saved = await this.deps.propertyRepository.update(property);

    if (!saved.success) {
      return failure(saved.error);
    }

    // Cascade-archive non-archived assets (archived_at only — ownership untouched).
    const assets = await this.deps.assetRepository.findAssetsByProperty(
      property.id,
      false
    );

    if (assets.success) {
      for (const a of assets.value) {
        const r = a.archive(at);

        if (r.success) {
          await this.deps.assetRepository.updateAsset(a);
        }
      }
    }

    // Auto-deny any pending claims on assets in this property.
    const denied = await this.deps.autoDenyClaims.executeForProperty({
      propertyId: property.id,
      systemReason: ClaimDenialReason.parse('property archived'),
    });

    if (!denied.success) {
      return denied;
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
