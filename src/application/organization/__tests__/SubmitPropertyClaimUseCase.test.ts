import { describe, it, expect } from 'vitest';
import { SubmitPropertyClaimUseCase } from '../SubmitPropertyClaimUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../../domain/organization/PropertyAssetOwnership';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const prop = OrganizationProperty.reconstitute({
  id: 'p-1',
  organizationId: 'org-1',
  name: 'A',
  address: null,
  sizeUnit: 'SQUARE_METERS',
  createdAt: new Date(),
  archivedAt: null,
});
const asset = PropertyAsset.reconstitute({
  id: 'a-1',
  propertyId: 'p-1',
  name: 'Apt',
  size: 50,
  createdAt: new Date(),
  archivedAt: null,
});
const placeholder = PropertyAssetOwnership.reconstitute({
  id: 'o-1',
  assetId: 'a-1',
  userId: null,
  externalOwnerLabel: 'Record owner',
  share: 1,
  effectiveFrom: new Date(),
  effectiveUntil: null,
  createdAt: new Date(),
});

function mkDeps(
  overrides: Partial<{
    isMember: boolean;
    pendingClaims: any[];
    latestDecided: any | null;
    notify: () => void;
  }> = {}
) {
  const cfg = {
    isMember: true,
    pendingClaims: [],
    latestDecided: null,
    notify: () => {},
    ...overrides,
  };
  const saved: any[] = [];
  const savedAttachments: any[] = [];
  const deps = {
    claimRepository: {
      findPendingForAsset: async () => success(cfg.pendingClaims),
      findLatestDecidedForUserAndAsset: async () => success(cfg.latestDecided),
      // Capture both halves of the atomic write the use case now performs
      // via the combined transactional method.
      saveWithOptionalAttachment: async (input: {
        claim: PropertyClaim;
        attachment?: { entity: any; bytes: Buffer };
      }) => {
        saved.push(input.claim);
        (input.claim as any).props.id = 'claim-saved-id';

        if (input.attachment) {
          savedAttachments.push({
            attachment: input.attachment.entity,
            bytes: input.attachment.bytes,
          });
        }

        return success(input.claim);
      },
    } as any,
    assetRepository: {
      findAssetById: async () => success(asset),
      findActiveOwnershipForAsset: async () => success([placeholder]),
    } as any,
    propertyRepository: { findById: async () => success(prop) } as any,
    organizationRepository: { isUserMember: async () => cfg.isMember } as any,
    notify: { execute: async () => cfg.notify() } as any,
  };

  return { deps, saved, savedAttachments };
}

describe('SubmitPropertyClaimUseCase', () => {
  it('creates a PENDING claim and sends notification', async () => {
    let notified = false;
    const { deps, saved } = mkDeps({ notify: () => (notified = true) });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(true);
    expect(saved.length).toBe(1);
    expect(notified).toBe(true);
  });

  it('accepts an ownerless asset (no active ownership rows at all)', async () => {
    // An asset that the admin just added without owners should still be
    // claimable — the user is saying "I own this; sign me up". Approval
    // creates the first ownership row.
    const { deps, saved } = mkDeps();
    deps.assetRepository.findActiveOwnershipForAsset = async () => success([]);
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(true);
    expect(saved.length).toBe(1);
  });

  it('accepts a claim even when the user already has a registered share on the asset', async () => {
    // The user might legitimately need to claim more share they just bought.
    // Reconciliation (sum existing + claimed share) happens at approval —
    // not here. This test pins the submit phase as permissive.
    const existingHelen = {
      id: 'o-helen-existing',
      assetId: 'a-1',
      userId: 'u-1', // same user submitting the claim
      externalOwnerLabel: null,
      share: 0.1,
    };
    const { deps, saved } = mkDeps();
    deps.assetRepository.findActiveOwnershipForAsset = async () =>
      success([placeholder, existingHelen]);
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(true);
    expect(saved.length).toBe(1);
  });

  it('rejects when the SAME user already has a pending claim on the asset (own-pending code)', async () => {
    // Defense-in-depth alongside the UI filter on ListClaimableAssets:
    // the use case is the trust boundary. A second submit from the same
    // user must be refused even if the listing is bypassed (direct API
    // call, replay, race condition between two tabs).
    //
    // The error code is distinct from the generic "another user's pending"
    // case so the UI can give the user a clear message ("your previous
    // claim is still under review") instead of the ambiguous "someone has
    // a pending claim on this asset".
    const mine = PropertyClaim.submit('org-1', 'u-1', 'a-1');

    if (!mine.success) {
      throw new Error('setup');
    }

    const { deps, saved } = mkDeps({ pendingClaims: [mine.value] });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(false);

    if (r.success) {
      return;
    }

    expect(r.error).toBe(
      OrganizationDomainCodes.PROPERTY_CLAIM_OWN_PENDING_FOR_ASSET
    );
    // Critical: nothing was written. A second pending row would corrupt
    // both the queue (admin sees duplicates) and the cooldown logic.
    expect(saved.length).toBe(0);
  });

  it('rejects when another claim is already pending for the asset', async () => {
    const dup = PropertyClaim.submit('org-1', 'u-2', 'a-1');

    if (!dup.success) {
      throw new Error('setup');
    }

    const { deps } = mkDeps({ pendingClaims: [dup.value] });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ALREADY_PENDING_FOR_ASSET
      );
    }
  });

  it('blocks re-claim within the cooldown window of a prior decision', async () => {
    const prior = PropertyClaim.submit('org-1', 'u-1', 'a-1');

    if (!prior.success) {
      throw new Error('setup');
    }

    prior.value.deny('admin', 'no', new Date()); // decidedAt = now
    const { deps } = mkDeps({ latestDecided: prior.value });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'u-1',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_REPEAT_BLOCKED_DURING_COOLDOWN
      );
    }
  });

  it('rejects non-member', async () => {
    const { deps } = mkDeps({ isMember: false });
    const uc = new SubmitPropertyClaimUseCase(deps);
    const r = await uc.execute({
      userId: 'stranger',
      organizationId: 'org-1',
      assetId: 'a-1',
    });
    expect(r.success).toBe(false);
  });

  describe('optional proof attachment', () => {
    it('saves the attachment alongside the claim atomically when bytes provided', async () => {
      const { deps, saved, savedAttachments } = mkDeps();
      const uc = new SubmitPropertyClaimUseCase(deps);
      // Real PDF magic-number prefix so the upload-time signature check passes.
      const bytes = Buffer.from('%PDF-1.4 fake content', 'ascii');
      const r = await uc.execute({
        userId: 'u-1',
        organizationId: 'org-1',
        assetId: 'a-1',
        attachment: {
          fileName: 'deed.pdf',
          mimeType: 'application/pdf',
          bytes,
        },
      });
      expect(r.success).toBe(true);
      expect(saved.length).toBe(1);
      // Both halves landed in the same atomic call (mocked here as a single
      // saveWithOptionalAttachment invocation that captures both).
      expect(savedAttachments.length).toBe(1);
      expect(savedAttachments[0].attachment.fileName).toBe('deed.pdf');
      expect(savedAttachments[0].attachment.mimeType).toBe('application/pdf');
      expect(savedAttachments[0].attachment.sizeBytes).toBe(bytes.length);
      expect(savedAttachments[0].bytes).toEqual(bytes);
    });

    it('does not call the attachment repo when no attachment provided', async () => {
      const { deps, saved, savedAttachments } = mkDeps();
      const uc = new SubmitPropertyClaimUseCase(deps);
      const r = await uc.execute({
        userId: 'u-1',
        organizationId: 'org-1',
        assetId: 'a-1',
      });
      expect(r.success).toBe(true);
      expect(saved.length).toBe(1);
      expect(savedAttachments.length).toBe(0);
    });

    it('rejects an over-sized file before saving anything', async () => {
      const { deps, saved, savedAttachments } = mkDeps();
      const uc = new SubmitPropertyClaimUseCase(deps);
      const r = await uc.execute({
        userId: 'u-1',
        organizationId: 'org-1',
        assetId: 'a-1',
        attachment: {
          fileName: 'huge.pdf',
          mimeType: 'application/pdf',
          // 10 MB + 1 byte
          bytes: Buffer.alloc(10 * 1024 * 1024 + 1),
        },
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TOO_LARGE
      );
      // Critical: the claim must NOT be saved if the attachment is invalid.
      // Otherwise the user ends up with a claim row and no proof, violating
      // their submitted intent.
      expect(saved.length).toBe(0);
      expect(savedAttachments.length).toBe(0);
    });

    it('rejects a disallowed mime type before saving anything', async () => {
      const { deps, saved, savedAttachments } = mkDeps();
      const uc = new SubmitPropertyClaimUseCase(deps);
      const r = await uc.execute({
        userId: 'u-1',
        organizationId: 'org-1',
        assetId: 'a-1',
        attachment: {
          fileName: 'evil.exe',
          mimeType: 'application/x-msdownload',
          bytes: Buffer.from([0]),
        },
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_TYPE_NOT_ALLOWED
      );
      expect(saved.length).toBe(0);
      expect(savedAttachments.length).toBe(0);
    });

    it('rejects rename-attack: bytes do not match declared mime', async () => {
      const { deps, saved, savedAttachments } = mkDeps();
      const uc = new SubmitPropertyClaimUseCase(deps);
      const r = await uc.execute({
        userId: 'u-1',
        organizationId: 'org-1',
        assetId: 'a-1',
        attachment: {
          // 'MZ' = DOS executable signature; user lies and says it's a PDF.
          fileName: 'fake.pdf',
          mimeType: 'application/pdf',
          bytes: Buffer.from([0x4d, 0x5a, 0x90, 0x00]),
        },
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_ATTACHMENT_MAGIC_MISMATCH
      );
      expect(saved.length).toBe(0);
      expect(savedAttachments.length).toBe(0);
    });
  });
});
