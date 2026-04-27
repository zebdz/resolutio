'use server';

import { getTranslations } from 'next-intl/server';
import {
  prisma,
  PrismaPropertyClaimRepository,
  PrismaPropertyClaimAttachmentRepository,
  PrismaPropertyAssetRepository,
  PrismaOrganizationPropertyRepository,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { SubmitPropertyClaimUseCase } from '@/application/organization/SubmitPropertyClaimUseCase';
import { ApprovePropertyClaimUseCase } from '@/application/organization/ApprovePropertyClaimUseCase';
import { DenyPropertyClaimUseCase } from '@/application/organization/DenyPropertyClaimUseCase';
import { ListOrgPropertiesForMemberUseCase } from '@/application/organization/ListOrgPropertiesForMemberUseCase';
import { ListClaimableAssetsUseCase } from '@/application/organization/ListClaimableAssetsUseCase';
import { NotifyPropertyClaimSubmittedUseCase } from '@/application/notification/NotifyPropertyClaimSubmittedUseCase';
import { NotifyPropertyClaimApprovedUseCase } from '@/application/notification/NotifyPropertyClaimApprovedUseCase';
import { NotifyPropertyClaimDeniedUseCase } from '@/application/notification/NotifyPropertyClaimDeniedUseCase';
import { getCurrentUser } from '@/web/lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

const claimRepository = new PrismaPropertyClaimRepository(prisma);
const claimAttachmentRepository = new PrismaPropertyClaimAttachmentRepository(
  prisma
);
const assetRepository = new PrismaPropertyAssetRepository(prisma);
const propertyRepository = new PrismaOrganizationPropertyRepository(prisma);
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);
const profanityChecker = LeoProfanityChecker.getInstance();

const notifySubmitted = new NotifyPropertyClaimSubmittedUseCase({
  notificationRepository,
  claimRepository,
});
const notifyApproved = new NotifyPropertyClaimApprovedUseCase({
  notificationRepository,
  claimRepository,
});
const notifyDenied = new NotifyPropertyClaimDeniedUseCase({
  notificationRepository,
  claimRepository,
});

const submit = new SubmitPropertyClaimUseCase({
  claimRepository,
  assetRepository,
  propertyRepository,
  organizationRepository,
  notify: notifySubmitted,
});
const approve = new ApprovePropertyClaimUseCase({
  claimRepository,
  assetRepository,
  propertyRepository,
  organizationRepository,
  userRepository,
  notifyApproved,
  notifyDenied,
});
const deny = new DenyPropertyClaimUseCase({
  claimRepository,
  organizationRepository,
  userRepository,
  profanityChecker,
  notifyDenied,
});
const listOrgProperties = new ListOrgPropertiesForMemberUseCase({
  propertyRepository,
  organizationRepository,
  userRepository,
});
const listClaimableAssets = new ListClaimableAssetsUseCase({
  propertyRepository,
  assetRepository,
  organizationRepository,
  userRepository,
  claimRepository,
});

async function requireUser(): Promise<{ error: string } | { userId: string }> {
  const u = await getCurrentUser();

  if (!u) {
    const t = await getTranslations('common.errors');

    return { error: t('unauthorized') as string };
  }

  return { userId: u.id };
}

// Accepts FormData so an optional File can ride along with the claim.
// Fields:
//   organizationId : string
//   assetId        : string
//   proof          : File (optional) — the proof-of-ownership upload
export async function submitPropertyClaimAction(
  formData: FormData
): Promise<ActionResult<{ claimId: string }>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const t = await getTranslations('common.errors');

  const organizationId = formData.get('organizationId');
  const assetId = formData.get('assetId');

  if (typeof organizationId !== 'string' || typeof assetId !== 'string') {
    return { success: false, error: t('generic') };
  }

  // The browser sends an empty File object when the input is left blank;
  // treat 0-byte files as "no attachment" rather than bouncing them through
  // the validator (which would emit a confusing "name empty" error).
  const proof = formData.get('proof');
  let attachment:
    | { fileName: string; mimeType: string; bytes: Buffer }
    | undefined;

  if (proof instanceof File && proof.size > 0) {
    const arrayBuffer = await proof.arrayBuffer();
    attachment = {
      fileName: proof.name,
      mimeType: proof.type,
      bytes: Buffer.from(arrayBuffer),
    };
  }

  const r = await submit.execute({
    userId: auth.userId,
    organizationId,
    assetId,
    attachment,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: { claimId: r.value.id } };
}

// Metadata-only listing for the admin queue's "Download proof" links and
// the claimant's own "My claims" page. Bytes are NEVER sent here — the
// download route handler is the only path that streams the actual content.
export async function listClaimAttachmentsAction(input: {
  claimId: string;
}): Promise<
  ActionResult<
    Array<{ id: string; fileName: string; mimeType: string; sizeBytes: number }>
  >
> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const t = await getTranslations('common.errors');

  // Authorisation: only the claimant, an org admin, or a superadmin can see
  // a claim's attachments. Mirrors the download route guard so the list
  // never reveals filenames the caller wouldn't be allowed to download.
  const claimRes = await claimRepository.findById(input.claimId);

  if (!claimRes.success || !claimRes.value) {
    return { success: false, error: t('generic') };
  }

  const claim = claimRes.value;
  const isClaimant = claim.userId === auth.userId;
  const isSuper = await userRepository.isSuperAdmin(auth.userId);
  const isAdmin =
    !isSuper &&
    (await organizationRepository.isUserAdmin(
      auth.userId,
      claim.organizationId
    ));

  if (!isClaimant && !isAdmin && !isSuper) {
    return { success: false, error: t('unauthorized') };
  }

  const r = await claimAttachmentRepository.findByClaimId(input.claimId);

  if (!r.success) {
    return { success: false, error: t('generic') };
  }

  return {
    success: true,
    data: r.value.map((a) => ({
      id: a.id,
      fileName: a.fileName,
      mimeType: a.mimeType,
      sizeBytes: a.sizeBytes,
    })),
  };
}

export async function approvePropertyClaimAction(input: {
  claimId: string;
  // Required when the asset has >1 placeholder ownership row — admin
  // picks which slot the claimant takes over. Server validates the id
  // belongs to a placeholder on this asset.
  targetOwnershipId?: string;
}): Promise<ActionResult> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await approve.execute({
    claimId: input.claimId,
    adminUserId: auth.userId,
    targetOwnershipId: input.targetOwnershipId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function denyPropertyClaimAction(input: {
  claimId: string;
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

  const r = await deny.execute({
    claimId: input.claimId,
    adminUserId: auth.userId,
    reason: input.reason,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: undefined };
}

export async function listOrgPropertiesForMemberAction(input: {
  organizationId: string;
}): Promise<
  ActionResult<{
    properties: { id: string; name: string; address: string | null }[];
  }>
> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await listOrgProperties.execute({
    userId: auth.userId,
    organizationId: input.organizationId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: { properties: r.value } };
}

export async function listClaimableAssetsAction(input: {
  organizationId: string;
  propertyId: string;
}): Promise<ActionResult<{ assets: { id: string; name: string }[] }>> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const r = await listClaimableAssets.execute({
    userId: auth.userId,
    organizationId: input.organizationId,
    propertyId: input.propertyId,
  });

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return { success: true, data: { assets: r.value } };
}

export async function listPendingClaimsForOrgAction(input: {
  organizationId: string;
}): Promise<
  ActionResult<{
    rows: {
      id: string;
      assetId: string;
      assetName: string;
      propertyId: string;
      propertyName: string;
      claimantFirstName: string;
      claimantLastName: string;
      claimantMiddleName: string | null;
      externalOwnerLabel: string | null;
      createdAt: string;
      attachments: Array<{
        id: string;
        fileName: string;
        mimeType: string;
        sizeBytes: number;
      }>;
      // Placeholder ownership rows on the claimed asset. Drives the slot
      // picker when there are 2+ external owners — admin must choose
      // which one the claimant is, otherwise approval is rejected.
      placeholders: Array<{
        ownershipId: string;
        label: string | null;
        sharePercent: number;
      }>;
    }[];
  }>
> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const isAdmin = await organizationRepository.isUserAdmin(
    auth.userId,
    input.organizationId
  );
  const isSuper = await userRepository.isSuperAdmin(auth.userId);

  if (!isAdmin && !isSuper) {
    return {
      success: false,
      error: await translateErrorCode('organization.errors.notAdmin'),
    };
  }

  const r = await claimRepository.findPendingForOrg(input.organizationId);

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  // Pull attachment metadata + placeholder ownership rows for each pending
  // claim in parallel. Bytes are never selected — the dedicated download
  // route streams them under its own auth check. Placeholders feed the
  // admin's slot-picker when an asset has >1 external owner.
  const rowsWithAttachments = await Promise.all(
    r.value.map(async (x) => {
      const [att, ownerships] = await Promise.all([
        claimAttachmentRepository.findByClaimId(x.claim.id),
        assetRepository.findActiveOwnershipForAsset(x.claim.assetId),
      ]);
      const placeholders = ownerships.success
        ? ownerships.value
            .filter((o) => o.userId === null)
            .map((o) => ({
              ownershipId: o.id,
              label: o.externalOwnerLabel,
              sharePercent: o.share * 100,
            }))
        : [];

      return {
        id: x.claim.id,
        assetId: x.claim.assetId,
        assetName: x.assetName,
        propertyId: x.propertyId,
        propertyName: x.propertyName,
        claimantFirstName: x.claimantFirstName,
        claimantLastName: x.claimantLastName,
        claimantMiddleName: x.claimantMiddleName,
        externalOwnerLabel: x.externalOwnerLabel,
        createdAt: x.claim.createdAt.toISOString(),
        attachments: att.success
          ? att.value.map((a) => ({
              id: a.id,
              fileName: a.fileName,
              mimeType: a.mimeType,
              sizeBytes: a.sizeBytes,
            }))
          : [],
        placeholders,
      };
    })
  );

  return { success: true, data: { rows: rowsWithAttachments } };
}

export async function listMyClaimsForPropertyAction(input: {
  organizationId: string;
  propertyId: string;
}): Promise<
  ActionResult<{
    rows: {
      id: string;
      assetName: string;
      status: string;
      deniedReason: string | null;
      createdAt: string;
      decidedAt: string | null;
    }[];
  }>
> {
  const rl = await checkRateLimit();

  if (rl) {
    return rl;
  }

  const auth = await requireUser();

  if ('error' in auth) {
    return { success: false, error: auth.error };
  }

  const isMember = await organizationRepository.isUserMember(
    auth.userId,
    input.organizationId
  );

  if (!isMember) {
    return {
      success: false,
      error: await translateErrorCode('domain.organization.notOrgMember'),
    };
  }

  const r = await claimRepository.findMyClaimsForProperty(
    auth.userId,
    input.propertyId
  );

  if (!r.success) {
    return { success: false, error: await translateErrorCode(r.error) };
  }

  return {
    success: true,
    data: {
      rows: r.value.map((x) => ({
        id: x.claim.id,
        assetName: x.assetName,
        status: x.claim.status,
        deniedReason: x.claim.deniedReason,
        createdAt: x.claim.createdAt.toISOString(),
        decidedAt: x.claim.decidedAt ? x.claim.decidedAt.toISOString() : null,
      })),
    },
  };
}
