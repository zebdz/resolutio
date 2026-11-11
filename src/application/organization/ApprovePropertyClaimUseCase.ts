/** Application boundary validates raw requests before invoking property/claim
 * behavior, and supplies explicit identity/time through injected dependencies. */
import {
  OrganizationId,
  PropertyClaimId,
  OwnershipId,
  UserId,
} from '../../domain/shared/EntityIds';
import {
  ClaimDenialReason,
  OwnershipShare,
} from '../../domain/organization/PropertyValues';
import { Clock, IdGenerator } from '../shared/EntityCreation';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { UserRepository } from '../../domain/user/UserRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { NotifyPropertyClaimApprovedUseCase } from '../notification/NotifyPropertyClaimApprovedUseCase';
import { NotifyPropertyClaimDeniedUseCase } from '../notification/NotifyPropertyClaimDeniedUseCase';

export interface ApprovePropertyClaimInput {
  claimId: string;
  adminUserId: string;
  // Required when the claimed asset has more than one placeholder
  // ownership row — the admin must pick which slot the claimant takes
  // over (e.g., 70% vs 30% external owners). For 0 or 1 placeholders the
  // value is ignored.
  targetOwnershipId?: string;
}

export interface ApprovePropertyClaimDependencies {
  ids: IdGenerator;
  clock: Clock;
  claimRepository: PropertyClaimRepository;
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  userRepository: UserRepository;
  notifyApproved: NotifyPropertyClaimApprovedUseCase;
  notifyDenied: NotifyPropertyClaimDeniedUseCase;
}

export class ApprovePropertyClaimUseCase {
  constructor(private deps: ApprovePropertyClaimDependencies) {}

  async execute(
    input: ApprovePropertyClaimInput
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

    // Three paths into approval, depending on the asset's current state:
    //   - 1 placeholder        → auto-link (SCD-1) to that slot.
    //   - >1 placeholders      → admin must specify targetOwnershipId so
    //                            the share assignment is deterministic
    //                            (no "first row Prisma returns" mis-attribution).
    //   - 0 placeholders + 0 active rows → ownerless → create a fresh 100% row.
    //   - 0 placeholders + only registered rows → not claimable → reject.
    const active = await this.deps.assetRepository.findActiveOwnershipForAsset(
      claim.assetId
    );

    if (!active.success) {
      return failure(active.error);
    }

    const placeholders = active.value.filter((o) => o.userId === null);
    const isOwnerless = active.value.length === 0;

    if (placeholders.length === 0 && !isOwnerless) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }

    // Resolve which placeholder to link before mutating any state. Doing
    // the validation before claim.approve() means a bad target leaves the
    // claim PENDING rather than approving + failing the link.
    //
    // The target is validated WHENEVER it's provided, not only when there
    // are multiple placeholders. A registered-owner row id passed by a
    // tampered request would otherwise silently steal that user's slot.
    let resolvedPlaceholderId: OwnershipId | null = null;

    if (input.targetOwnershipId) {
      const target = active.value.find((o) => o.id === input.targetOwnershipId);

      if (!target || target.userId !== null) {
        return failure(
          OrganizationDomainCodes.PROPERTY_CLAIM_TARGET_OWNERSHIP_INVALID
        );
      }

      resolvedPlaceholderId = target.id;
    } else if (placeholders.length === 1) {
      resolvedPlaceholderId = placeholders[0].id;
    } else if (placeholders.length > 1) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_MULTIPLE_PLACEHOLDERS_REQUIRE_TARGET
      );
    }

    const existingForClaimant = active.value.find(
      (o) => o.userId === claim.userId
    );
    const placeholder = active.value.find(
      (o) => o.id === resolvedPlaceholderId
    );
    let merge: {
      existingId: OwnershipId;
      placeholderId: OwnershipId;
      share: OwnershipShare;
    } | null = null;

    if (existingForClaimant && placeholder) {
      const share = OwnershipShare.safeParse(
        existingForClaimant.share + placeholder.share
      );

      if (!share.success) {
        return failure(
          OrganizationDomainCodes.PROPERTY_ASSET_OWNERSHIP_SHARE_OUT_OF_RANGE
        );
      }

      merge = {
        existingId: existingForClaimant.id,
        placeholderId: placeholder.id,
        share: share.data,
      };
    }

    const at = this.deps.clock.now();
    const transition = claim.approve(adminUserId.data, at);

    if (!transition.success) {
      return failure(transition.error);
    }

    const saved = await this.deps.claimRepository.update(claim);

    if (!saved.success) {
      return failure(saved.error);
    }

    if (resolvedPlaceholderId) {
      // Reconciliation: if the claimant already has an active ownership
      // row on this asset (e.g., they previously owned 10% as a registered
      // user, then bought another 20% from an external owner), don't
      // create a second row in their name. End-date the placeholder and
      // fold its share into their existing row. Otherwise the asset
      // would carry two effective rows for the same user — corrupts the
      // weight calc and the "one row per owner" invariant.
      if (merge) {
        const merged =
          await this.deps.assetRepository.mergePlaceholderIntoExistingOwner({
            at,
            placeholderOwnershipId: merge.placeholderId,
            existingOwnershipId: merge.existingId,
            newShare: merge.share,
          });

        if (!merged.success) {
          return failure(merged.error);
        }
      } else {
        const linked = await this.deps.assetRepository.linkOwnershipToUser({
          ownershipId: resolvedPlaceholderId,
          userId: claim.userId,
        });

        if (!linked.success) {
          return failure(linked.error);
        }
      }
    } else {
      // Ownerless → first claimant becomes the 100% owner. If the building
      // later has co-owners, an admin can use Edit owners to redistribute.
      const created = await this.deps.assetRepository.createOwnershipForUser({
        ownershipId: this.deps.ids.generate(OwnershipId),
        at,
        assetId: claim.assetId,
        userId: claim.userId,
        share: OwnershipShare.parse(1),
      });

      if (!created.success) {
        return failure(created.error);
      }
    }

    // Auto-deny sibling pending claims on the same asset.
    const siblings = await this.deps.claimRepository.findPendingForAsset(
      claim.assetId
    );

    if (siblings.success) {
      for (const s of siblings.value) {
        if (s.id === claim.id) {
          continue;
        }

        const auto = s.autoDeny(
          ClaimDenialReason.parse('another claim approved'),
          at
        );

        if (auto.success) {
          await this.deps.claimRepository.update(s);
          const delivery = await this.deps.notifyDenied.execute({
            claimId: s.id,
          });

          if (!delivery.success) {
            return failure('common.errors.unexpected');
          }
        }
      }
    }

    const delivery = await this.deps.notifyApproved.execute({
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
