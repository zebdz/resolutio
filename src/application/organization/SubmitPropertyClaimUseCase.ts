import { PropertyClaim } from '../../domain/organization/PropertyClaim';
import { PropertyClaimRepository } from '../../domain/organization/PropertyClaimRepository';
import { PropertyAssetRepository } from '../../domain/organization/PropertyAssetRepository';
import { OrganizationPropertyRepository } from '../../domain/organization/OrganizationPropertyRepository';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { PropertyClaimAttachment } from '../../domain/organization/PropertyClaimAttachment';
import { Result, success, failure } from '../../domain/shared/Result';
import { OrganizationDomainCodes } from '../../domain/organization/OrganizationDomainCodes';
import { NotifyPropertyClaimSubmittedUseCase } from '../notification/NotifyPropertyClaimSubmittedUseCase';

export interface SubmitPropertyClaimInput {
  userId: string;
  organizationId: string;
  assetId: string;
  // Optional proof-of-ownership upload. Validated against domain rules
  // (size, MIME) BEFORE the transaction opens; the claim + attachment are
  // then written atomically so the user can never end up with a claim row
  // that's blocked from re-submit (ALREADY_PENDING) but missing its proof.
  attachment?: {
    fileName: string;
    mimeType: string;
    bytes: Buffer;
  };
}

export interface SubmitPropertyClaimDependencies {
  claimRepository: PropertyClaimRepository;
  assetRepository: PropertyAssetRepository;
  propertyRepository: OrganizationPropertyRepository;
  organizationRepository: OrganizationRepository;
  notify: NotifyPropertyClaimSubmittedUseCase;
}

const REPEAT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

export class SubmitPropertyClaimUseCase {
  constructor(private deps: SubmitPropertyClaimDependencies) {}

  async execute(
    input: SubmitPropertyClaimInput
  ): Promise<Result<PropertyClaim, string>> {
    if (
      !(await this.deps.organizationRepository.isUserMember(
        input.userId,
        input.organizationId
      ))
    ) {
      return failure(OrganizationDomainCodes.NOT_ORG_MEMBER);
    }

    const aRes = await this.deps.assetRepository.findAssetById(input.assetId);

    if (!aRes.success || !aRes.value || aRes.value.isArchived()) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }

    const asset = aRes.value;
    const pRes = await this.deps.propertyRepository.findById(asset.propertyId);

    if (
      !pRes.success ||
      !pRes.value ||
      pRes.value.organizationId !== input.organizationId ||
      pRes.value.isArchived()
    ) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }

    // Asset is claimable when it's either:
    //   (a) placeholder-owned — has an active ownership row with userId = null
    //       (someone is recorded by name but not yet a registered user), OR
    //   (b) ownerless — no active ownership rows at all (admin just created it)
    // If every active row already maps to a registered user, there is nothing
    // for a new claimant to pick up.
    const active = await this.deps.assetRepository.findActiveOwnershipForAsset(
      asset.id
    );

    if (!active.success) {
      return failure(active.error);
    }

    const isOwnerless = active.value.length === 0;
    const hasPlaceholder = active.value.some((r) => r.userId === null);

    if (!isOwnerless && !hasPlaceholder) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ASSET_NOT_CLAIMABLE
      );
    }

    // Existing pending claim on the same asset blocks this submission. Two
    // distinct cases produce two distinct error codes so the UI can speak
    // appropriately: "your previous claim is still under review" vs.
    // "someone else's claim is still under review". Order matters — the
    // own-pending case is checked first so a user with their own pending
    // claim never sees the generic "someone has a pending claim" message.
    const pending = await this.deps.claimRepository.findPendingForAsset(
      asset.id
    );

    if (!pending.success) {
      return failure(pending.error);
    }

    if (pending.value.some((c) => c.userId === input.userId)) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_OWN_PENDING_FOR_ASSET
      );
    }

    if (pending.value.length > 0) {
      return failure(
        OrganizationDomainCodes.PROPERTY_CLAIM_ALREADY_PENDING_FOR_ASSET
      );
    }

    // Repeat-after-denial cooldown: same user, same asset, within REPEAT_COOLDOWN_MS of last decision.
    const latest =
      await this.deps.claimRepository.findLatestDecidedForUserAndAsset(
        input.userId,
        asset.id
      );

    if (!latest.success) {
      return failure(latest.error);
    }

    if (latest.value && latest.value.decidedAt) {
      const age = Date.now() - latest.value.decidedAt.getTime();

      if (age < REPEAT_COOLDOWN_MS) {
        return failure(
          OrganizationDomainCodes.PROPERTY_CLAIM_REPEAT_BLOCKED_DURING_COOLDOWN
        );
      }
    }

    // Pure-validation pass on the attachment BEFORE we open the transaction.
    // Validates size + MIME whitelist + magic-number signature so a renamed
    // .exe (declared as application/pdf) is bounced before any DB write.
    let attachmentEntity: PropertyClaimAttachment | null = null;

    if (input.attachment) {
      const attR = PropertyClaimAttachment.createWithBytes({
        claimId: '__pending__',
        fileName: input.attachment.fileName,
        mimeType: input.attachment.mimeType,
        bytes: input.attachment.bytes,
      });

      if (!attR.success) {
        return failure(attR.error);
      }

      attachmentEntity = attR.value;
    }

    const created = PropertyClaim.submit(
      input.organizationId,
      input.userId,
      asset.id
    );

    if (!created.success) {
      return failure(created.error);
    }

    // One transaction covers both writes — see PropertyClaimRepository
    // .saveWithOptionalAttachment for why atomicity matters here.
    const saved = await this.deps.claimRepository.saveWithOptionalAttachment({
      claim: created.value,
      attachment:
        attachmentEntity && input.attachment
          ? {
              entity: attachmentEntity,
              bytes: input.attachment.bytes,
            }
          : undefined,
    });

    if (!saved.success) {
      return failure(saved.error);
    }

    await this.deps.notify.execute({ claimId: saved.value.id });

    return success(saved.value);
  }
}
