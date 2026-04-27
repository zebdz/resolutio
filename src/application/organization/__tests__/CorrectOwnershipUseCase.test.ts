import { describe, it, expect } from 'vitest';
import { CorrectOwnershipUseCase } from '../CorrectOwnershipUseCase';
import { OrganizationProperty } from '../../../domain/organization/OrganizationProperty';
import { PropertyAsset } from '../../../domain/organization/PropertyAsset';
import { PropertyAssetOwnership } from '../../../domain/organization/PropertyAssetOwnership';
import { OrganizationDomainCodes } from '../../../domain/organization/OrganizationDomainCodes';
import { success } from '../../../domain/shared/Result';
import { ProfanityChecker } from '../../../domain/shared/profanity/ProfanityChecker';
import { SharedDomainCodes } from '../../../domain/shared/SharedDomainCodes';

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

function mkOwnership(id: string, share = 0.5): PropertyAssetOwnership {
  // reconstitute rather than createForUser so we can give each row a distinct id —
  // the use case's sum-check reducer uses id-equality to substitute the new share,
  // which only works correctly when ids are distinct.
  return PropertyAssetOwnership.reconstitute({
    id,
    assetId: 'a-1',
    userId: 'u-1',
    externalOwnerLabel: null,
    share,
    effectiveFrom: new Date(),
    effectiveUntil: null,
    createdAt: new Date(),
  });
}

const cleanChecker: ProfanityChecker = {
  containsProfanity: (t) => t.includes('badword'),
};

function mkDeps(
  opts: Partial<{
    locked: boolean;
    activeShares: number[];
  }> = {}
) {
  const cfg = { locked: false, activeShares: [0.5, 0.5], ...opts };
  const calls: any[] = [];
  const activeOwnerships = cfg.activeShares.map((s, i) =>
    mkOwnership(`o-${i + 1}`, s)
  );
  const target = activeOwnerships[0];
  const lockFacts = cfg.locked
    ? [
        {
          explicitScopePropertyIds: ['p-1'],
          distributionType: 'OWNERSHIP_UNIT_COUNT',
        },
      ]
    : [];
  const deps = {
    assetRepository: {
      findAssetById: async () => success(asset),
      findOwnershipById: async () => success(target),
      findActiveOwnershipForAsset: async () => success(activeOwnerships),
      correctOwnership: async (input: any) => {
        calls.push(input);

        return success(undefined);
      },
    } as any,
    propertyRepository: { findById: async () => success(prop) } as any,
    organizationRepository: { isUserAdmin: async () => true } as any,
    userRepository: { isSuperAdmin: async () => false } as any,
    lockRepository: {
      findSnapshotFactsForProperty: async () => success(lockFacts),
    } as any,
    profanityChecker: cleanChecker,
  };

  return { deps, calls, target };
}

describe('CorrectOwnershipUseCase', () => {
  it('applies correction and preserves sum=1 across active rows', async () => {
    const { deps, calls } = mkDeps({ activeShares: [0.4, 0.6] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.4, // keep current first share; sum of actives stays 1.0
      reason: 'fix typo',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(true);
    expect(calls[0].newShare).toBe(0.4);
  });

  it('rejects correction that breaks sum=1', async () => {
    // Active rows currently 0.5 + 0.5. Attempt to correct the first to 0.7 → 1.2 total → reject.
    const { deps } = mkDeps({ activeShares: [0.5, 0.5] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.7,
      reason: 'fix',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.SHARES_DO_NOT_SUM_TO_ONE);
    }
  });

  it('rejects when property is locked', async () => {
    const { deps } = mkDeps({ locked: true, activeShares: [0.4, 0.6] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.4,
      reason: 'fix',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(
        OrganizationDomainCodes.CANNOT_CORRECT_LOCKED_PROPERTY
      );
    }
  });

  it('rejects empty reason', async () => {
    const { deps } = mkDeps({ activeShares: [0.5, 0.5] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.5,
      reason: '   ',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(OrganizationDomainCodes.CORRECTION_REASON_EMPTY);
    }
  });

  it('rejects profane reason', async () => {
    const { deps } = mkDeps({ activeShares: [0.5, 0.5] });
    const uc = new CorrectOwnershipUseCase(deps);
    const r = await uc.execute({
      ownershipId: 'o-1',
      newShare: 0.5,
      reason: 'badword reason',
      adminUserId: 'admin',
    });
    expect(r.success).toBe(false);

    if (!r.success) {
      expect(r.error).toBe(SharedDomainCodes.CONTAINS_PROFANITY);
    }
  });

  describe('cross-tree lock propagation', () => {
    // Scenario: Property P lives in org B. Parent org A ran an ownership-based
    // poll with EMPTY scope (= "all properties in my tree"), and that snapshot
    // implicitly included B's property. Correction on B's property must now
    // be blocked.
    // The Prisma PropertyLockRepository.findSnapshotFactsForProperty walks up
    // the ancestor chain and returns the A-level fact. The use case then hands
    // it to PropertyLockService.isLocked, which flags the empty-scope +
    // ownership combination as a lock.
    it('blocks correction when an ancestor-org empty-scope ownership poll has taken a snapshot', async () => {
      const { deps } = mkDeps({ activeShares: [0.4, 0.6] });
      // Override the lock repo to return a cross-tree fact: empty scope,
      // ownership mode — this is what findSnapshotFactsForProperty would
      // return after traversing P's ancestor chain.
      deps.lockRepository = {
        findSnapshotFactsForProperty: async () =>
          success([
            {
              explicitScopePropertyIds: [], // parent A-level poll had empty scope
              distributionType: 'OWNERSHIP_SIZE_WEIGHTED',
            },
          ]),
      } as any;
      const uc = new CorrectOwnershipUseCase(deps);
      const r = await uc.execute({
        ownershipId: 'o-1',
        newShare: 0.4,
        reason: 'fix typo',
        adminUserId: 'admin',
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.CANNOT_CORRECT_LOCKED_PROPERTY
        );
      }
    });

    it('allows correction when only EQUAL empty-scope polls exist (no ownership consulted)', async () => {
      const { deps } = mkDeps({ activeShares: [0.4, 0.6] });
      deps.lockRepository = {
        findSnapshotFactsForProperty: async () =>
          success([
            {
              explicitScopePropertyIds: [], // empty scope
              distributionType: 'EQUAL', // ownership was never consulted
            },
          ]),
      } as any;
      const uc = new CorrectOwnershipUseCase(deps);
      const r = await uc.execute({
        ownershipId: 'o-1',
        newShare: 0.4,
        reason: 'fix typo',
        adminUserId: 'admin',
      });
      expect(r.success).toBe(true);
    });

    it('blocks correction when an ancestor-org EQUAL poll explicitly scoped this property', async () => {
      // EQUAL + explicit scope still locks: ownership was used as the
      // eligibility filter for that snapshot.
      const { deps } = mkDeps({ activeShares: [0.4, 0.6] });
      deps.lockRepository = {
        findSnapshotFactsForProperty: async () =>
          success([
            {
              explicitScopePropertyIds: ['p-1'],
              distributionType: 'EQUAL',
            },
          ]),
      } as any;
      const uc = new CorrectOwnershipUseCase(deps);
      const r = await uc.execute({
        ownershipId: 'o-1',
        newShare: 0.4,
        reason: 'fix typo',
        adminUserId: 'admin',
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.CANNOT_CORRECT_LOCKED_PROPERTY
        );
      }
    });
  });

  describe('archived guards', () => {
    it('rejects when the asset is archived', async () => {
      const { deps } = mkDeps({ activeShares: [0.4, 0.6] });
      const archivedAsset = PropertyAsset.reconstitute({
        id: 'a-1',
        propertyId: 'p-1',
        name: 'Archived',
        size: 50,
        createdAt: new Date(),
        archivedAt: new Date(),
      });
      deps.assetRepository.findAssetById = async () => success(archivedAsset);
      const uc = new CorrectOwnershipUseCase(deps);
      const r = await uc.execute({
        ownershipId: 'o-1',
        newShare: 0.4,
        reason: 'fix typo',
        adminUserId: 'admin',
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(
          OrganizationDomainCodes.PROPERTY_ASSET_ALREADY_ARCHIVED
        );
      }
    });

    it('rejects when the property is archived', async () => {
      const { deps } = mkDeps({ activeShares: [0.4, 0.6] });
      const archivedProp = OrganizationProperty.reconstitute({
        id: 'p-1',
        organizationId: 'org-1',
        name: 'A',
        address: null,
        sizeUnit: 'SQUARE_METERS',
        createdAt: new Date(),
        archivedAt: new Date(),
      });
      deps.propertyRepository.findById = async () => success(archivedProp);
      const uc = new CorrectOwnershipUseCase(deps);
      const r = await uc.execute({
        ownershipId: 'o-1',
        newShare: 0.4,
        reason: 'fix typo',
        adminUserId: 'admin',
      });
      expect(r.success).toBe(false);

      if (!r.success) {
        expect(r.error).toBe(OrganizationDomainCodes.PROPERTY_ALREADY_ARCHIVED);
      }
    });
  });
});
