/** Direct claim-list callers must see read failures, not incomplete success responses.
 * Mock outbound reads while exercising the real action, permission gate and projections. */
import { beforeEach, expect, it, vi } from 'vitest';
import { PropertyClaim } from '@/domain/organization/PropertyClaim';
import type { PendingClaimListRow } from '@/domain/organization/PropertyClaimRepository';
import { AssetName, PropertyName } from '@/domain/organization/PropertyValues';
import { PropertyId, UserId } from '@/domain/shared/EntityIds';
import { failure, success } from '@/domain/shared/Result';
import { FirstName, LastName } from '@/domain/user/UserValues';

const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  rateLimit: vi.fn(),
  pending: vi.fn(),
  attachments: vi.fn(),
  ownerships: vi.fn(),
  isAdmin: vi.fn(),
  isSuper: vi.fn(),
}));
vi.mock('@/infrastructure/index', () => ({
  prisma: {},
  PrismaPropertyClaimRepository: class {
    findPendingForOrg = mocks.pending;
  },
  PrismaPropertyClaimAttachmentRepository: class {
    findByClaimId = mocks.attachments;
  },
  PrismaPropertyAssetRepository: class {
    findActiveOwnershipForAsset = mocks.ownerships;
  },
  PrismaOrganizationRepository: class {
    isUserAdmin = mocks.isAdmin;
  },
  PrismaUserRepository: class {
    isSuperAdmin = mocks.isSuper;
  },
  PrismaOrganizationPropertyRepository: class {},
  PrismaNotificationRepository: class {},
}));
vi.mock('@/infrastructure/profanity/LeoProfanityChecker', () => ({
  LeoProfanityChecker: {
    getInstance: () => ({ containsProfanity: () => false }),
  },
}));
vi.mock('@/web/lib/session', () => ({ getCurrentUser: mocks.currentUser }));
vi.mock('@/web/actions/rateLimit', () => ({ checkRateLimit: mocks.rateLimit }));
vi.mock('@/web/actions/utils/translateErrorCode', () => ({
  translateErrorCode: async (code: string) => `translated:${code}`,
}));
vi.mock('next-intl/server', () => ({
  getTranslations: async () => (key: string) => key,
}));

const { listPendingClaimsForOrgAction } = await import('../propertyClaim');
const createdAt = '2026-11-04T12:00:00.000Z';
const row: PendingClaimListRow = {
  claim: PropertyClaim.reconstitute({
    id: 'claim-1',
    organizationId: 'org-1',
    userId: 'claimant-1',
    assetId: 'asset-1',
    status: 'PENDING',
    deniedReason: null,
    decidedBy: null,
    decidedAt: null,
    createdAt: new Date(createdAt),
  }),
  assetName: AssetName.parse('Unit'),
  propertyId: PropertyId.parse('property-1'),
  propertyName: PropertyName.parse('Building'),
  claimantFirstName: FirstName.parse('Alice'),
  claimantLastName: LastName.parse('Smith'),
  claimantMiddleName: null,
  externalOwnerLabel: null,
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.currentUser.mockResolvedValue({ id: UserId.parse('admin-1') });
  mocks.rateLimit.mockResolvedValue(null);
  mocks.isAdmin.mockResolvedValue(true);
  mocks.isSuper.mockResolvedValue(false);
  mocks.pending.mockResolvedValue(success([row]));
  mocks.attachments.mockResolvedValue(success([]));
  mocks.ownerships.mockResolvedValue(success([]));
});

it.each(['attachments', 'ownerships'] as const)(
  'reports a failed %s read instead of displaying an empty list',
  async (read) => {
    mocks[read].mockResolvedValue(failure('common.errors.unexpected'));

    await expect(
      listPendingClaimsForOrgAction({ organizationId: 'org-1' })
    ).resolves.toEqual({
      success: false,
      error: 'translated:common.errors.unexpected',
    });
  }
);

it('preserves successful empty attachment and ownership lists', async () => {
  await expect(
    listPendingClaimsForOrgAction({ organizationId: 'org-1' })
  ).resolves.toEqual({
    success: true,
    data: {
      rows: [
        {
          id: 'claim-1',
          assetId: 'asset-1',
          assetName: 'Unit',
          propertyId: 'property-1',
          propertyName: 'Building',
          claimantFirstName: 'Alice',
          claimantLastName: 'Smith',
          claimantMiddleName: null,
          externalOwnerLabel: null,
          createdAt,
          attachments: [],
          placeholders: [],
        },
      ],
    },
  });
});
