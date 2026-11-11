'use server';

/** Authenticated actions decode requests and serialize permitted property/ownership data.
 * Core identities, quantities and instants stay typed until the client boundary. */

/** Server-only property operations keep authorization and serialization at the
 * boundary, then pass validated identities and explicit creation dependencies inward. */
import { PrismaOrganizationDirectory } from '@/infrastructure/repositories/PrismaOrganizationDirectory';
import {
  OrganizationId,
  PropertyId,
  AssetId,
  PropertyClaimId,
  UserId,
} from '@/domain/shared/EntityIds';
import {
  CryptoIdGenerator,
  SystemClock,
} from '@/infrastructure/shared/SystemEntityCreation';

import { revalidatePath } from 'next/cache';
import { getTranslations } from 'next-intl/server';
import {
  prisma,
  PrismaOrganizationPropertyRepository,
  PrismaPropertyAssetRepository,
  PrismaPropertyClaimRepository,
  PrismaPropertyLockRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { CreatePropertyUseCase } from '@/application/organization/CreatePropertyUseCase';
import { UpdatePropertyUseCase } from '@/application/organization/UpdatePropertyUseCase';
import { ArchivePropertyUseCase } from '@/application/organization/ArchivePropertyUseCase';
import { UnarchivePropertyUseCase } from '@/application/organization/UnarchivePropertyUseCase';
import { CreateAssetUseCase } from '@/application/organization/CreateAssetUseCase';
import { UpdateAssetUseCase } from '@/application/organization/UpdateAssetUseCase';
import { ArchiveAssetUseCase } from '@/application/organization/ArchiveAssetUseCase';
import { UnarchiveAssetUseCase } from '@/application/organization/UnarchiveAssetUseCase';
import {
  ReplaceAssetOwnersUseCase,
  OwnerInput,
} from '@/application/organization/ReplaceAssetOwnersUseCase';
import { CorrectOwnershipUseCase } from '@/application/organization/CorrectOwnershipUseCase';
import { SearchOrgTreeMembersUseCase } from '@/application/organization/SearchOrgTreeMembersUseCase';
import { AutoDenyPendingClaimsOnArchiveUseCase } from '@/application/organization/AutoDenyPendingClaimsOnArchiveUseCase';
import { NotifyPropertyClaimDeniedUseCase } from '@/application/notification/NotifyPropertyClaimDeniedUseCase';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';
import {
  serializeProperty,
  serializeAsset,
  serializeActiveOwnership,
  serializeOwnershipRow,
  serializeTreeMember,
  type PropertiesView,
  type AssetsView,
  type ActiveOwnershipsView,
  type OwnershipRowsView,
  type TreeMembersView,
} from './serializeProperty';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const propertyRepository = new PrismaOrganizationPropertyRepository(prisma);
const assetRepository = new PrismaPropertyAssetRepository(prisma);
const claimRepository = new PrismaPropertyClaimRepository(prisma);
const lockRepository = new PrismaPropertyLockRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);
const profanityChecker = LeoProfanityChecker.getInstance();
const ids = new CryptoIdGenerator();
const clock = new SystemClock();

const notifyDenied = new NotifyPropertyClaimDeniedUseCase({
  ids: ids,
  clock: clock,
  notificationRepository,
  claimRepository,
});
const autoDenyClaims = new AutoDenyPendingClaimsOnArchiveUseCase({
  clock,
  claimRepository,
  assetRepository,
  notifyDenied,
});

const createProperty = new CreatePropertyUseCase({
  ids,
  clock,
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const updateProperty = new UpdatePropertyUseCase({
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const archiveProperty = new ArchivePropertyUseCase({
  clock,
  propertyRepository,
  assetRepository,
  organizationRepository,
  userRepository,
  autoDenyClaims,
});
const unarchiveProperty = new UnarchivePropertyUseCase({
  propertyRepository,
  assetRepository,
  organizationRepository,
  userRepository,
});
const createAsset = new CreateAssetUseCase({
  ids,
  clock,
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const updateAsset = new UpdateAssetUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
});
const archiveAsset = new ArchiveAssetUseCase({
  clock,
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  autoDenyClaims,
});
const unarchiveAsset = new UnarchiveAssetUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
});
const replaceOwners = new ReplaceAssetOwnersUseCase({
  ids,
  clock,
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
});
const correctOwnership = new CorrectOwnershipUseCase({
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  lockRepository,
  profanityChecker,
});

async function requireUser(): Promise<{ error: string } | { userId: UserId }> {
  const u = await getCurrentUser();

  if (!u) {
    const t = await getTranslations('common.errors');

    return { error: t('unauthorized') as string };
  }

  return { userId: u.id };
}

export async function createPropertyAction(input: {
  organizationId: string;
  name: string;
  address: string | null;
  sizeUnit: string;
}): Promise<ActionResult<{ propertyId: PropertyId }>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await createProperty.execute({
    organizationId: input.organizationId,
    adminUserId: auth.userId,
    name: input.name,
    address: input.address,
    sizeUnit: input.sizeUnit,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  revalidatePath(`/organizations/${input.organizationId}/manage-properties`);

  return { success: true, data: { propertyId: r.value.property.id } };
}

export async function updatePropertyAction(input: {
  propertyId: string;
  name?: string;
  address?: string | null;
  sizeUnit?: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await updateProperty.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
    name: input.name,
    address: input.address,
    sizeUnit: input.sizeUnit,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function archivePropertyAction(input: {
  propertyId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await archiveProperty.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function unarchivePropertyAction(input: {
  propertyId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await unarchiveProperty.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function createAssetAction(input: {
  propertyId: string;
  name: string;
  size: number;
}): Promise<ActionResult<{ assetId: AssetId }>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await createAsset.execute({
    propertyId: input.propertyId,
    adminUserId: auth.userId,
    name: input.name,
    size: input.size,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: { assetId: r.value.asset.id } };
}

export async function updateAssetAction(input: {
  assetId: string;
  name?: string;
  size?: number;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await updateAsset.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
    name: input.name,
    size: input.size,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function archiveAssetAction(input: {
  assetId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await archiveAsset.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function unarchiveAssetAction(input: {
  assetId: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await unarchiveAsset.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function replaceAssetOwnersAction(input: {
  assetId: string;
  owners: OwnerInput[];
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await replaceOwners.execute({
    assetId: input.assetId,
    adminUserId: auth.userId,
    owners: input.owners,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function correctOwnershipAction(input: {
  ownershipId: string;
  newShare: number;
  reason: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await correctOwnership.execute({
    ownershipId: input.ownershipId,
    newShare: input.newShare,
    reason: input.reason,
    adminUserId: auth.userId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function listPropertiesAction(input: {
  organizationId: string;
}): Promise<ActionResult<PropertiesView>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const organizationId = OrganizationId.safeParse(input.organizationId);

  if (!organizationId.success) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notFound'),
    };
  }

  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    organizationId.data
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);

  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }

  const r = await propertyRepository.findAllByOrganizationIncludingArchived(
    organizationId.data
  );

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return {
    success: true,
    data: {
      properties: r.value.map(serializeProperty),
    },
  };
}

export async function listAssetsAction(input: {
  propertyId: string;
  includeArchived: boolean;
}): Promise<ActionResult<AssetsView>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const propertyId = PropertyId.safeParse(input.propertyId);

  if (!propertyId.success) {
    return {
      success: false,
      error: await translateErrorCode('domain.organization.propertyNotFound'),
    };
  }

  const pRes = await propertyRepository.findById(propertyId.data);

  if (!pRes.success || !pRes.value) {
    return {
      success: false,
      error: await translateErrorCode('domain.organization.propertyNotFound'),
    };
  }

  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    pRes.value.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);

  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }

  const r = await assetRepository.findAssetsByProperty(
    propertyId.data,
    input.includeArchived
  );

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return {
    success: true,
    data: {
      assets: r.value.map(serializeAsset),
    },
  };
}

export async function listActiveOwnershipForAssetAction(input: {
  assetId: string;
}): Promise<ActionResult<ActiveOwnershipsView>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const assetId = AssetId.safeParse(input.assetId);

  if (!assetId.success) {
    return {
      success: false,
      error: await translateErrorCode(
        'domain.organization.propertyAssetNotFound'
      ),
    };
  }

  const aRes = await assetRepository.findAssetById(assetId.data);

  if (!aRes.success || !aRes.value) {
    return {
      success: false,
      error: await translateErrorCode(
        'domain.organization.propertyAssetNotFound'
      ),
    };
  }

  const pRes = await propertyRepository.findById(aRes.value.propertyId);

  if (!pRes.success || !pRes.value) {
    return {
      success: false,
      error: await translateErrorCode('domain.organization.propertyNotFound'),
    };
  }

  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    pRes.value.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);

  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }

  const r = await assetRepository.findActiveOwnershipForAsset(assetId.data);

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  // Side-fetch user names for any user-owned rows so the modal can display
  // them directly (no extra round-trip from the client).
  const userIds = r.value
    .map((o) => o.userId)
    .filter((id): id is UserId => id !== null);
  const users = userIds.length
    ? await prisma.user.findMany({
        where: { id: { in: userIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          middleName: true,
          nickname: true,
        },
      })
    : [];
  const profileById = new Map(users.map((user) => [user.id, user]));
  const labelByUserId = new Map<UserId, string>();

  for (const userId of userIds) {
    const u = profileById.get(userId);

    if (!u) {
      continue;
    }

    const fullName = [u.lastName, u.firstName, u.middleName]
      .filter(Boolean)
      .join(' ');
    labelByUserId.set(userId, `${fullName} (@${u.nickname})`);
  }

  return {
    success: true,
    data: {
      ownerships: r.value.map((o) =>
        serializeActiveOwnership(o, labelByUserId)
      ),
    },
  };
}

export async function listOwnershipRowsAction(input: {
  organizationId: string;
  activeOnly: boolean;
  ownerQuery?: string;
  assetQuery?: string;
  propertyId?: string;
}): Promise<ActionResult<OwnershipRowsView>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const organizationId = OrganizationId.safeParse(input.organizationId);

  if (!organizationId.success) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notFound'),
    };
  }

  const propertyId =
    input.propertyId === undefined
      ? undefined
      : PropertyId.safeParse(input.propertyId);

  if (propertyId && !propertyId.success) {
    return {
      success: false,
      error: await translateErrorCode('domain.organization.propertyNotFound'),
    };
  }

  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    organizationId.data
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);

  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }

  const r = await assetRepository.findOwnershipRows({
    ...input,
    organizationId: organizationId.data,
    propertyId: propertyId?.data,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return {
    success: true,
    data: {
      rows: r.value.map(serializeOwnershipRow),
    },
  };
}

const searchOrgTreeMembers = new SearchOrgTreeMembersUseCase({
  directory: new PrismaOrganizationDirectory(prisma),
  organizationRepository,
  userRepository,
});

export async function searchOrgTreeMembersAction(input: {
  organizationId: string;
  query: string;
  limit?: number;
}): Promise<ActionResult<TreeMembersView>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await searchOrgTreeMembers.execute({
    rootOrganizationId: input.organizationId,
    actorUserId: auth.userId,
    query: input.query,
    limit: input.limit ?? 20,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return {
    success: true,
    data: {
      matches: r.value.map(serializeTreeMember),
    },
  };
}
