'use server';

/** Invitation and membership actions authorize requests, compose application ports,
 * and serialize localized, permitted browser payloads. */

import { PrismaMembershipStore } from '@/infrastructure/repositories/PrismaMembershipStore';
import { PrismaOrganizationDirectory } from '@/infrastructure/repositories/PrismaOrganizationDirectory';
import { serializeDirectoryMember } from '@/web/actions/organization/serializeDirectory';
import {
  CryptoIdGenerator,
  SystemClock,
} from '@/infrastructure/shared/SystemEntityCreation';
import { getTranslations } from 'next-intl/server';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { CreateAdminInviteUseCase } from '@/application/invitation/CreateAdminInviteUseCase';
import { CreateBoardMemberInviteUseCase } from '@/application/invitation/CreateBoardMemberInviteUseCase';
import { CreateOrgMemberInviteUseCase } from '@/application/invitation/CreateOrgMemberInviteUseCase';
import { HandleInviteUseCase } from '@/application/invitation/HandleInviteUseCase';
import { RevokeInviteUseCase } from '@/application/invitation/RevokeInviteUseCase';
import { GetPendingAdminInvitesUseCase } from '@/application/invitation/GetPendingAdminInvitesUseCase';
import { GetPendingBoardInvitesUseCase } from '@/application/invitation/GetPendingBoardInvitesUseCase';
import { GetPendingMemberInvitesUseCase } from '@/application/invitation/GetPendingMemberInvitesUseCase';
import { GetInviteDetailsUseCase } from '@/application/invitation/GetInviteDetailsUseCase';
import {
  serializeInviteDetails,
  InviteDetailsDto,
  type PendingInviteView,
} from './serializeInviteDetails';
import { GetUserPendingInvitesUseCase } from '@/application/invitation/GetUserPendingInvitesUseCase';
import { GetOrgMembersUseCase } from '@/application/organization/GetOrgMembersUseCase';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
  PrismaInvitationRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';

// Action result type
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string };

// Dependencies
const organizationRepository = new PrismaOrganizationRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);
const invitationRepository = new PrismaInvitationRepository(prisma);

export async function createAdminInviteAction(
  organizationId: string,
  inviteeId: string
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new CreateAdminInviteUseCase({
      ids: new CryptoIdGenerator(),
      clock: new SystemClock(),
      invitationRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });

    const result = await useCase.execute({
      organizationId,
      inviteeId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error creating admin invite:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function createBoardMemberInviteAction(
  boardId: string,
  inviteeId: string
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new CreateBoardMemberInviteUseCase({
      ids: new CryptoIdGenerator(),
      clock: new SystemClock(),
      invitationRepository,
      boardRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });

    const result = await useCase.execute({
      boardId,
      inviteeId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error creating board member invite:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function createOrgMemberInviteAction(
  organizationId: string,
  inviteeId: string
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new CreateOrgMemberInviteUseCase({
      ids: new CryptoIdGenerator(),
      clock: new SystemClock(),
      memberships: new PrismaMembershipStore(prisma),
      invitationRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });

    const result = await useCase.execute({
      organizationId,
      inviteeId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error creating org member invite:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function handleInviteAction(
  invitationId: string,
  action: 'accept' | 'decline'
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new HandleInviteUseCase({
      ids: new CryptoIdGenerator(),
      clock: new SystemClock(),
      memberships: new PrismaMembershipStore(prisma),
      invitationRepository,
      organizationRepository,
      boardRepository,
      userRepository,
      notificationRepository,
    });

    const result = await useCase.execute({
      invitationId,
      action,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error handling invite:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function revokeInviteAction(
  invitationId: string
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new RevokeInviteUseCase({
      ids: new CryptoIdGenerator(),
      clock: new SystemClock(),
      invitationRepository,
      organizationRepository,
      userRepository,
      notificationRepository,
    });

    const result = await useCase.execute({
      invitationId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error revoking invite:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function getPendingAdminInvitesAction(
  organizationId: string
): Promise<ActionResult<PendingInviteView[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new GetPendingAdminInvitesUseCase({
      invitationRepository,
      organizationRepository,
      userRepository,
    });

    const result = await useCase.execute({
      organizationId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: result.value.map((inv) => ({
        id: inv.id,
        inviteeId: inv.inviteeId,
        inviterId: inv.inviterId,
        createdAt: inv.createdAt,
      })),
    };
  } catch (error) {
    console.error('Error fetching pending admin invites:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function getPendingBoardInvitesAction(
  boardId: string
): Promise<ActionResult<PendingInviteView[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new GetPendingBoardInvitesUseCase({
      invitationRepository,
      organizationRepository,
      boardRepository,
      userRepository,
    });

    const result = await useCase.execute({
      boardId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: result.value.map((inv) => ({
        id: inv.id,
        inviteeId: inv.inviteeId,
        inviterId: inv.inviterId,
        createdAt: inv.createdAt,
      })),
    };
  } catch (error) {
    console.error('Error fetching pending board invites:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function getPendingMemberInvitesAction(
  organizationId: string
): Promise<ActionResult<PendingInviteView[]>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new GetPendingMemberInvitesUseCase({
      invitationRepository,
      organizationRepository,
      userRepository,
    });

    const result = await useCase.execute({
      organizationId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: result.value.map((inv) => ({
        id: inv.id,
        inviteeId: inv.inviteeId,
        inviterId: inv.inviterId,
        createdAt: inv.createdAt,
      })),
    };
  } catch (error) {
    console.error('Error fetching pending member invites:', error);

    return { success: false, error: t('unexpected') };
  }
}

export async function getInviteDetailsAction(invitationId: string) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new GetInviteDetailsUseCase({
      invitationRepository,
      organizationRepository,
      boardRepository,
      userRepository,
    });

    const result = await useCase.execute(invitationId);

    if (!result.success) {
      return {
        success: false as const,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true as const,
      data: serializeInviteDetails(result.value),
    };
  } catch (error) {
    console.error('Error fetching invite details:', error);

    return { success: false as const, error: t('unexpected') };
  }
}

export async function getOrgMembersAction(
  organizationId: string,
  page: number = 1,
  pageSize: number = 20,
  query?: string
) {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false as const, error: t('unauthorized') };
    }

    const useCase = new GetOrgMembersUseCase({
      directory: new PrismaOrganizationDirectory(prisma),
      organizationRepository,
      userRepository,
    });

    const result = await useCase.execute({
      organizationId,
      actorUserId: user.id,
      page,
      pageSize,
      query,
    });

    if (!result.success) {
      return {
        success: false as const,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true as const,
      data: {
        members: result.value.members.map(serializeDirectoryMember),
        totalCount: result.value.totalCount,
      },
    };
  } catch (error) {
    console.error('Error fetching org members:', error);

    return { success: false as const, error: t('unexpected') };
  }
}

export async function getUserPendingInvitesAction(): Promise<
  ActionResult<InviteDetailsDto[]>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const useCase = new GetUserPendingInvitesUseCase({
      invitationRepository,
      organizationRepository,
      boardRepository,
      userRepository,
    });

    const result = await useCase.execute({ actorUserId: user.id });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: result.value.map(serializeInviteDetails) };
  } catch (error) {
    console.error('Error fetching user pending invites:', error);

    return { success: false, error: t('unexpected') };
  }
}
