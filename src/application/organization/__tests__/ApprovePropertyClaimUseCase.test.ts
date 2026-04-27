import { describe, it, expect } from 'vitest';
import { ApprovePropertyClaimUseCase } from '../ApprovePropertyClaimUseCase';
import { PropertyClaim } from '../../../domain/organization/PropertyClaim';
import { PropertyAssetOwnership } from '../../../domain/organization/PropertyAssetOwnership';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';

const claim = PropertyClaim.reconstitute({
  id: 'c-main',
  organizationId: 'org-1',
  userId: 'u-42',
  assetId: 'a-1',
  status: 'PENDING',
  deniedReason: null,
  decidedBy: null,
  decidedAt: null,
  createdAt: new Date(),
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

describe('ApprovePropertyClaimUseCase', () => {
  it('approves an ownerless asset by creating a new 100% ownership row', async () => {
    // No active rows exist (admin created C-Spot #6 with no owners). Approval
    // must create a fresh ownership row for the claimant — there is nothing
    // to "link" because no placeholder exists.
    const ownerlessClaim = PropertyClaim.reconstitute({
      id: 'c-ownerless',
      organizationId: 'org-1',
      userId: 'u-99',
      assetId: 'a-2',
      status: 'PENDING',
      deniedReason: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: new Date(),
    });
    let created: any = null;
    let linked: any = null;
    let notified = 0;
    const uc = new ApprovePropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(ownerlessClaim),
        update: async () => success(undefined),
        findPendingForAsset: async () => success([]),
      } as any,
      assetRepository: {
        findActiveOwnershipForAsset: async () => success([]),
        linkOwnershipToUser: async (input: any) => {
          linked = input;

          return success(undefined);
        },
        createOwnershipForUser: async (input: any) => {
          created = input;

          return success(undefined);
        },
      } as any,
      propertyRepository: { findById: async () => success(null) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      notifyApproved: {
        execute: async () => {
          notified++;
        },
      } as any,
      notifyDenied: { execute: async () => {} } as any,
    });
    const r = await uc.execute({
      claimId: ownerlessClaim.id,
      adminUserId: 'admin',
    });
    expect(r.success).toBe(true);
    expect(ownerlessClaim.status).toBe('APPROVED');
    // Used the create path, not the link path.
    expect(linked).toBeNull();
    expect(created).toEqual({
      assetId: 'a-2',
      userId: 'u-99',
      share: 1,
    });
    expect(notified).toBe(1);
  });

  it('links user, auto-denies siblings, notifies', async () => {
    const sibling = PropertyClaim.reconstitute({
      id: 'c-sibling',
      organizationId: 'org-1',
      userId: 'u-7',
      assetId: 'a-1',
      status: 'PENDING',
      deniedReason: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: new Date(),
    });
    const updated: string[] = [];
    let linked: any = null;
    let approvedNotified = 0;
    let deniedNotified = 0;
    const uc = new ApprovePropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(claim),
        update: async (c: PropertyClaim) => {
          updated.push(c.id);

          return success(undefined);
        },
        findPendingForAsset: async () => success([sibling]),
      } as any,
      assetRepository: {
        findActiveOwnershipForAsset: async () => success([placeholder]),
        linkOwnershipToUser: async (input: any) => {
          linked = input;

          return success(undefined);
        },
      } as any,
      propertyRepository: { findById: async () => success(null) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      notifyApproved: {
        execute: async () => {
          approvedNotified++;
        },
      } as any,
      notifyDenied: {
        execute: async () => {
          deniedNotified++;
        },
      } as any,
    });
    const r = await uc.execute({ claimId: claim.id, adminUserId: 'admin' });
    expect(r.success).toBe(true);
    expect(claim.status).toBe('APPROVED');
    expect(linked.userId).toBe('u-42');
    expect(sibling.status).toBe('DENIED');
    expect(approvedNotified).toBe(1);
    expect(deniedNotified).toBe(1);
  });

  it('reconciles into the claimant existing share when they already own part of the asset', async () => {
    // Helen 10% (registered) + miss-c 20% (external placeholder). Helen
    // claims, admin approves. Result must be a single Helen row at 30%
    // — the placeholder row end-dates and its share folds into Helen's
    // existing row. Otherwise Helen ends up with two rows on the asset
    // (the "double Helen" bug). Build a fresh claim — the module-level
    // `claim` gets mutated by the previous test's claim.approve().
    const freshClaim = PropertyClaim.reconstitute({
      id: 'c-helen',
      organizationId: 'org-1',
      userId: 'u-42',
      assetId: 'a-1',
      status: 'PENDING',
      deniedReason: null,
      decidedBy: null,
      decidedAt: null,
      createdAt: new Date(),
    });
    const placeholder20 = PropertyAssetOwnership.reconstitute({
      id: 'o-placeholder',
      assetId: 'a-1',
      userId: null,
      externalOwnerLabel: 'miss-c',
      share: 0.2,
      effectiveFrom: new Date(),
      effectiveUntil: null,
      createdAt: new Date(),
    });
    const existingClaimantRow = PropertyAssetOwnership.reconstitute({
      id: 'o-existing',
      assetId: 'a-1',
      userId: 'u-42',
      externalOwnerLabel: null,
      share: 0.1,
      effectiveFrom: new Date(),
      effectiveUntil: null,
      createdAt: new Date(),
    });
    let linkedCount = 0;
    let merged: any = null;
    const uc = new ApprovePropertyClaimUseCase({
      claimRepository: {
        findById: async () => success(freshClaim),
        update: async () => success(undefined),
        findPendingForAsset: async () => success([]),
      } as any,
      assetRepository: {
        findActiveOwnershipForAsset: async () =>
          success([placeholder20, existingClaimantRow]),
        // The plain link path must NOT run when reconciliation applies —
        // it would leave Helen on the placeholder row AND on her existing
        // row at the same time.
        linkOwnershipToUser: async () => {
          linkedCount++;

          return success(undefined);
        },
        mergePlaceholderIntoExistingOwner: async (input: any) => {
          merged = input;

          return success(undefined);
        },
      } as any,
      propertyRepository: { findById: async () => success(null) } as any,
      organizationRepository: { isUserAdmin: async () => true } as any,
      userRepository: { isSuperAdmin: async () => false } as any,
      notifyApproved: { execute: async () => {} } as any,
      notifyDenied: { execute: async () => {} } as any,
    });
    const r = await uc.execute({
      claimId: freshClaim.id,
      adminUserId: 'admin',
    });
    expect(r.success).toBe(true);
    expect(linkedCount).toBe(0);
    expect(merged).toEqual({
      placeholderOwnershipId: 'o-placeholder',
      existingOwnershipId: 'o-existing',
      newShare: 0.30000000000000004, // 0.1 + 0.2 — JS float; close enough
    });
  });

  describe('multiple placeholders — admin must pick which slot to link', () => {
    // Two external owners on one asset (e.g., 70/30 split). The previous
    // behavior auto-linked to "the first placeholder Prisma returned",
    // which is non-deterministic and would silently mis-attribute the
    // share. The fix forces the admin to specify a target.
    function multiPlaceholderClaim() {
      return PropertyClaim.reconstitute({
        id: 'c-multi',
        organizationId: 'org-1',
        userId: 'u-42',
        assetId: 'a-1',
        status: 'PENDING',
        deniedReason: null,
        decidedBy: null,
        decidedAt: null,
        createdAt: new Date(),
      });
    }

    const placeholder70 = PropertyAssetOwnership.reconstitute({
      id: 'o-70',
      assetId: 'a-1',
      userId: null,
      externalOwnerLabel: 'Иванов И.И.',
      share: 0.7,
      effectiveFrom: new Date(),
      effectiveUntil: null,
      createdAt: new Date(),
    });
    const placeholder30 = PropertyAssetOwnership.reconstitute({
      id: 'o-30',
      assetId: 'a-1',
      userId: null,
      externalOwnerLabel: 'Петров П.П.',
      share: 0.3,
      effectiveFrom: new Date(),
      effectiveUntil: null,
      createdAt: new Date(),
    });

    function buildUc(opts: {
      onLink?: (input: any) => void;
      onCreate?: () => void;
    }) {
      return new ApprovePropertyClaimUseCase({
        claimRepository: {
          findById: async () => success(multiPlaceholderClaim()),
          update: async () => success(undefined),
          findPendingForAsset: async () => success([]),
        } as any,
        assetRepository: {
          findActiveOwnershipForAsset: async () =>
            success([placeholder70, placeholder30]),
          linkOwnershipToUser: async (input: any) => {
            opts.onLink?.(input);

            return success(undefined);
          },
          createOwnershipForUser: async () => {
            opts.onCreate?.();

            return success(undefined);
          },
        } as any,
        propertyRepository: { findById: async () => success(null) } as any,
        organizationRepository: { isUserAdmin: async () => true } as any,
        userRepository: { isSuperAdmin: async () => false } as any,
        notifyApproved: { execute: async () => {} } as any,
        notifyDenied: { execute: async () => {} } as any,
      });
    }

    it('rejects without a targetOwnershipId when >1 placeholder exists', async () => {
      let linkedCount = 0;
      const uc = buildUc({ onLink: () => linkedCount++ });
      const r = await uc.execute({
        claimId: 'c-multi',
        adminUserId: 'admin',
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_MULTIPLE_PLACEHOLDERS_REQUIRE_TARGET
      );
      // Critical: nothing was linked. A non-deterministic auto-link would
      // mis-attribute the share.
      expect(linkedCount).toBe(0);
    });

    it('rejects when the targetOwnershipId points to a non-placeholder row', async () => {
      // Sneaky: admin (or a tampered UI) passes the id of a registered
      // owner row instead of a placeholder. Must refuse — overwriting an
      // existing user's userId would silently steal their slot.
      const registered = PropertyAssetOwnership.reconstitute({
        id: 'o-registered',
        assetId: 'a-1',
        userId: 'someone-else',
        externalOwnerLabel: null,
        share: 0.5,
        effectiveFrom: new Date(),
        effectiveUntil: null,
        createdAt: new Date(),
      });
      let linkedCount = 0;
      const uc = new ApprovePropertyClaimUseCase({
        claimRepository: {
          findById: async () => success(multiPlaceholderClaim()),
          update: async () => success(undefined),
          findPendingForAsset: async () => success([]),
        } as any,
        assetRepository: {
          findActiveOwnershipForAsset: async () =>
            success([placeholder70, registered]),
          linkOwnershipToUser: async () => {
            linkedCount++;

            return success(undefined);
          },
        } as any,
        propertyRepository: { findById: async () => success(null) } as any,
        organizationRepository: { isUserAdmin: async () => true } as any,
        userRepository: { isSuperAdmin: async () => false } as any,
        notifyApproved: { execute: async () => {} } as any,
        notifyDenied: { execute: async () => {} } as any,
      });
      const r = await uc.execute({
        claimId: 'c-multi',
        adminUserId: 'admin',
        targetOwnershipId: 'o-registered',
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_TARGET_OWNERSHIP_INVALID
      );
      expect(linkedCount).toBe(0);
    });

    it('rejects when the targetOwnershipId is for a different asset', async () => {
      const otherAssetPlaceholder = PropertyAssetOwnership.reconstitute({
        id: 'o-other',
        assetId: 'a-OTHER',
        userId: null,
        externalOwnerLabel: 'Stranger',
        share: 1,
        effectiveFrom: new Date(),
        effectiveUntil: null,
        createdAt: new Date(),
      });
      let linkedCount = 0;
      const uc = new ApprovePropertyClaimUseCase({
        claimRepository: {
          findById: async () => success(multiPlaceholderClaim()),
          update: async () => success(undefined),
          findPendingForAsset: async () => success([]),
        } as any,
        assetRepository: {
          // Only the two real placeholders for a-1 are active. The id passed
          // by the admin (`o-other`) belongs to a different asset and is
          // not in this list — so the validation rejects.
          findActiveOwnershipForAsset: async () =>
            success([placeholder70, placeholder30]),
          linkOwnershipToUser: async () => {
            linkedCount++;

            return success(undefined);
          },
        } as any,
        propertyRepository: { findById: async () => success(null) } as any,
        organizationRepository: { isUserAdmin: async () => true } as any,
        userRepository: { isSuperAdmin: async () => false } as any,
        notifyApproved: { execute: async () => {} } as any,
        notifyDenied: { execute: async () => {} } as any,
      });
      void otherAssetPlaceholder; // declared for documentation; not in the list
      const r = await uc.execute({
        claimId: 'c-multi',
        adminUserId: 'admin',
        targetOwnershipId: 'o-other',
      });
      expect(r.success).toBe(false);

      if (r.success) {
        return;
      }

      expect(r.error).toBe(
        OrganizationDomainCodes.PROPERTY_CLAIM_TARGET_OWNERSHIP_INVALID
      );
      expect(linkedCount).toBe(0);
    });

    it('links the chosen placeholder when targetOwnershipId is valid', async () => {
      let linked: any = null;
      const uc = buildUc({ onLink: (i) => (linked = i) });
      const r = await uc.execute({
        claimId: 'c-multi',
        adminUserId: 'admin',
        targetOwnershipId: 'o-30', // admin picks the 30% slot
      });
      expect(r.success).toBe(true);
      expect(linked).toEqual({ ownershipId: 'o-30', userId: 'u-42' });
    });
  });
});
