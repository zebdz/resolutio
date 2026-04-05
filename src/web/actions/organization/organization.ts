'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CreateOrganizationUseCase } from '@/application/organization/CreateOrganizationUseCase';
import { createOrganizationSchema } from '@/application/organization/CreateOrganizationSchema';
import { SearchOrganizationsUseCase } from '@/application/organization/SearchOrganizationsUseCase';
import { ArchiveOrganizationUseCase } from '@/application/organization/ArchiveOrganizationUseCase';
import { ArchiveOrganizationSchema } from '@/application/organization/ArchiveOrganizationSchema';
import { UnarchiveOrganizationUseCase } from '@/application/organization/UnarchiveOrganizationUseCase';
import { UnarchiveOrganizationSchema } from '@/application/organization/UnarchiveOrganizationSchema';
import { ListOrganizationsUseCase } from '@/application/organization/ListOrganizationsUseCase';
import { GetAdminOrganizationsUseCase } from '@/application/organization/GetAdminOrganizationsUseCase';
import { GetUserOrganizationsUseCase } from '@/application/organization/GetUserOrganizationsUseCase';
import { GetPendingRequestsUseCase } from '@/application/organization/GetPendingRequestsUseCase';
import { HandleJoinRequestUseCase } from '@/application/organization/HandleJoinRequestUseCase';
import { createHandleJoinRequestSchema } from '@/application/organization/HandleJoinRequestSchema';
import { JoinOrganizationUseCase } from '@/application/organization/JoinOrganizationUseCase';
import { JoinOrganizationSchema } from '@/application/organization/JoinOrganizationSchema';
import { GetOrganizationDetailsUseCase } from '@/application/organization/GetOrganizationDetailsUseCase';
import { GetOrganizationPendingRequestsUseCase } from '@/application/organization/GetOrganizationPendingRequestsUseCase';
import { CancelJoinRequestUseCase } from '@/application/organization/CancelJoinRequestUseCase';
import { CancelJoinRequestSchema } from '@/application/organization/CancelJoinRequestSchema';
import { UpdateOrganizationUseCase } from '@/application/organization/UpdateOrganizationUseCase';
import { updateOrganizationSchema } from '@/application/organization/UpdateOrganizationSchema';
import { RemoveOrgAdminUseCase } from '@/application/organization/RemoveOrgAdminUseCase';
import { LeaveOrganizationUseCase } from '@/application/organization/LeaveOrganizationUseCase';
import { GetOrgAdminsPaginatedUseCase } from '@/application/organization/GetOrgAdminsPaginatedUseCase';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
  PrismaInvitationRepository,
} from '@/infrastructure/index';
import { Notification } from '@/domain/notification/Notification';
import { getCurrentUser } from '../../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const organizationRepository = new PrismaOrganizationRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);
const invitationRepository = new PrismaInvitationRepository(prisma);
const profanityChecker = LeoProfanityChecker.getInstance();

// Use cases
const createOrganizationUseCase = new CreateOrganizationUseCase({
  organizationRepository,
  userRepository,
  profanityChecker,
});

const listOrganizationsUseCase = new ListOrganizationsUseCase({
  organizationRepository,
});

const getAdminOrganizationsUseCase = new GetAdminOrganizationsUseCase({
  organizationRepository,
});

const getUserOrganizationsUseCase = new GetUserOrganizationsUseCase({
  prisma,
});

const getPendingRequestsUseCase = new GetPendingRequestsUseCase({
  prisma,
});

const handleJoinRequestUseCase = new HandleJoinRequestUseCase({
  prisma,
  organizationRepository,
  notificationRepository,
  userRepository,
});

const joinOrganizationUseCase = new JoinOrganizationUseCase({
  organizationRepository,
  invitationRepository,
  notificationRepository,
  userRepository,
  prisma,
});

const getOrganizationDetailsUseCase = new GetOrganizationDetailsUseCase({
  organizationRepository,
  boardRepository,
  userRepository,
  prisma,
});

const cancelJoinRequestUseCase = new CancelJoinRequestUseCase({
  prisma,
  organizationRepository,
});

const getOrganizationPendingRequestsUseCase =
  new GetOrganizationPendingRequestsUseCase({
    prisma,
    userRepository,
  });

const archiveOrganizationUseCase = new ArchiveOrganizationUseCase({
  organizationRepository,
  notificationRepository,
  userRepository,
});

const unarchiveOrganizationUseCase = new UnarchiveOrganizationUseCase({
  organizationRepository,
  notificationRepository,
  userRepository,
});

const updateOrganizationUseCase = new UpdateOrganizationUseCase({
  organizationRepository,
  userRepository,
  notificationRepository,
  profanityChecker,
});

const removeOrgAdminUseCase = new RemoveOrgAdminUseCase({
  organizationRepository,
  userRepository,
  notificationRepository,
});

const searchOrganizationsUseCase = new SearchOrganizationsUseCase({
  organizationRepository,
});

const leaveOrganizationUseCase = new LeaveOrganizationUseCase({
  boardRepository,
  organizationRepository,
  userRepository,
  notificationRepository,
});

export async function createOrganizationAction(
  formData: FormData
): Promise<ActionResult<{ organizationId: string; autoJoinFailed?: boolean }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Extract form data
    const parentId = (formData.get('parentId') as string) || null;
    const allowMultiTreeMembershipRaw = formData.get(
      'allowMultiTreeMembership'
    );
    const input = {
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      parentId,
      autoJoin: formData.get('autoJoin') !== 'false',
      allowMultiTreeMembership: parentId
        ? false
        : allowMultiTreeMembershipRaw === 'true',
    };

    // Validate with Zod
    const validation =
      createOrganizationSchema(profanityChecker).safeParse(input);

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues
      );

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case
    const result = await createOrganizationUseCase.execute(
      validation.data,
      user.id
    );

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    const orgId = result.value.organization.id;

    // Auto-join: create pending membership and accept it
    if (validation.data.autoJoin) {
      try {
        await prisma.organizationUser.create({
          data: {
            organizationId: orgId,
            userId: user.id,
            status: 'pending',
          },
        });

        const acceptResult = await handleJoinRequestUseCase.execute({
          organizationId: orgId,
          requesterId: user.id,
          adminId: user.id,
          action: 'accept',
          silent: true,
        });

        if (!acceptResult.success) {
          throw new Error(acceptResult.error);
        }
      } catch (autoJoinError) {
        console.error('Auto-join failed after org creation:', autoJoinError);

        // Notify user to join manually
        const notification = Notification.create({
          userId: user.id,
          type: 'auto_join_failed',
          title: 'notification.types.autoJoinFailed.title',
          body: 'notification.types.autoJoinFailed.body',
          data: { organizationId: orgId, organizationName: input.name },
        });

        if (notification.success) {
          await notificationRepository
            .save(notification.value)
            .catch((err) =>
              console.error(
                'Failed to save auto-join failure notification:',
                err
              )
            );
        }

        return {
          success: true,
          data: {
            organizationId: orgId,
            autoJoinFailed: true,
          },
        };
      }
    }

    return {
      success: true,
      data: {
        organizationId: orgId,
      },
    };
  } catch (error) {
    console.error('Error creating organization:', error);

    // Check for Prisma unique constraint violation
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: t('duplicate_name'),
      };
    }

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function createOrganizationAndRedirect(
  locale: string,
  formData: FormData
): Promise<void> {
  // Rate limit handled by createOrganizationAction
  const result = await createOrganizationAction(formData);

  if (result.success) {
    redirect(`/${locale}/organizations/${result.data.organizationId}`);
  }
}

export async function listOrganizationsAction(): Promise<
  ActionResult<{
    organizations: Array<{
      id: string;
      name: string;
      description: string;
      memberCount: number;
      firstAdmin: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      } | null;
      parentOrg: { id: string; name: string } | null;
    }>;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const result = await listOrganizationsUseCase.execute();

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: {
        organizations: result.value.organizations.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          memberCount: item.memberCount,
          firstAdmin: item.firstAdmin,
          parentOrg: item.parentOrg,
        })),
      },
    };
  } catch (error) {
    console.error('Error listing organizations:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export interface SearchOrganizationsInput {
  search?: string;
  page?: number;
  pageSize?: number;
}

export async function searchOrganizationsNotAlreadyMemberOfAction(
  input: SearchOrganizationsInput
): Promise<
  ActionResult<{
    organizations: Array<{
      id: string;
      name: string;
      description: string;
      memberCount: number;
      firstAdmin: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      } | null;
      parentOrg: { id: string; name: string } | null;
    }>;
    totalCount: number;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    const result = await listOrganizationsUseCase.execute(input, user?.id);

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return {
      success: true,
      data: {
        organizations: result.value.organizations.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          memberCount: item.memberCount,
          firstAdmin: item.firstAdmin,
          parentOrg: item.parentOrg,
        })),
        totalCount: result.value.totalCount,
      },
    };
  } catch (error) {
    console.error('Error searching organizations:', error);

    return { success: false, error: t('generic') };
  }
}

export async function joinOrganizationAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tOrg = await getTranslations('organization');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Extract form data
    const input = {
      organizationId: formData.get('organizationId') as string,
    };

    // Validate with Zod
    const validation = JoinOrganizationSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues
      );

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case
    const result = await joinOrganizationUseCase.execute(
      validation.data,
      user.id
    );

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error joining organization:', error);

    // Check for Prisma unique constraint violation
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'P2002'
    ) {
      return {
        success: false,
        error: tOrg('errors.pendingRequest'),
      };
    }

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getAdminOrganizationsAction(): Promise<
  ActionResult<{
    organizations: Array<{
      id: string;
      name: string;
      description: string;
      archivedAt: Date | null;
      parentOrg: { id: string; name: string } | null;
    }>;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await getAdminOrganizationsUseCase.execute(user.id);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    // Fetch parent info for each org
    const organizations = await Promise.all(
      result.value.organizations.map(async (org) => {
        let parentOrg: { id: string; name: string } | null = null;

        if (org.parentId) {
          const parent = await organizationRepository.findById(org.parentId);

          if (parent) {
            parentOrg = { id: parent.id, name: parent.name };
          }
        }

        return {
          id: org.id,
          name: org.name,
          description: org.description,
          archivedAt: org.archivedAt,
          parentOrg,
        };
      })
    );

    return {
      success: true,
      data: { organizations },
    };
  } catch (error) {
    console.error('Error getting admin organizations:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getUserOrganizationsAction(): Promise<
  ActionResult<{
    member: Array<{
      id: string;
      name: string;
      description: string;
      joinedAt: Date;
      archivedAt: Date | null;
      parentOrg: { id: string; name: string } | null;
    }>;
    pending: Array<{
      id: string;
      name: string;
      description: string;
      requestedAt: Date;
      parentOrg: { id: string; name: string } | null;
    }>;
    rejected: Array<{
      id: string;
      name: string;
      description: string;
      rejectedAt: Date;
      rejectionReason: string | null;
      rejectedBy: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      };
      parentOrg: { id: string; name: string } | null;
    }>;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await getUserOrganizationsUseCase.execute(user.id);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: {
        member: result.value.member.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          joinedAt: item.joinedAt,
          archivedAt: item.organization.archivedAt,
          parentOrg: item.parentOrg,
        })),
        pending: result.value.pending.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          requestedAt: item.requestedAt,
          parentOrg: item.parentOrg,
        })),
        rejected: result.value.rejected.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          rejectedAt: item.rejectedAt,
          rejectionReason: item.rejectionReason,
          rejectedBy: item.rejectedBy,
          parentOrg: item.parentOrg,
        })),
      },
    };
  } catch (error) {
    console.error('Error getting user organizations:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getPendingRequestsAction(
  page?: number,
  pageSize?: number
): Promise<
  ActionResult<{
    requests: Array<{
      organizationId: string;
      organizationName: string;
      requester: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      };
      requestedAt: Date;
    }>;
    totalCount: number;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const pagination = page && pageSize ? { page, pageSize } : undefined;

    const result = await getPendingRequestsUseCase.execute(user.id, pagination);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: {
        requests: result.value.requests,
        totalCount: result.value.totalCount,
      },
    };
  } catch (error) {
    console.error('Error getting pending requests:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function handleJoinRequestAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const input = {
      organizationId: formData.get('organizationId') as string,
      requesterId: formData.get('requesterId') as string,
      adminId: user.id,
      action: formData.get('action') as 'accept' | 'reject',
      rejectionReason:
        formData.get('rejectionReason') || (undefined as string | undefined),
    };

    const validation =
      createHandleJoinRequestSchema(profanityChecker).safeParse(input);

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues
      );

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    const result = await handleJoinRequestUseCase.execute(validation.data);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error handling join request:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getOrganizationDetailsAction(
  organizationId: string
): Promise<
  ActionResult<{
    organization: {
      id: string;
      name: string;
      description: string;
      parentId: string | null;
      allowMultiTreeMembership: boolean | null;
      createdAt: Date;
    };
    boards: Array<{
      id: string;
      name: string;
      memberCount: number;
      members: Array<{
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      }>;
      isUserMember: boolean;
    }>;
    isUserMember: boolean;
    isUserAdmin: boolean;
    firstAdmin: {
      id: string;
      firstName: string;
      lastName: string;
      middleName: string | null;
    } | null;
    ancestors: Array<{ id: string; name: string; memberCount: number }>;
    hierarchyTree: {
      id: string;
      name: string;
      memberCount: number;
      children: any[];
    };
    rootOrgMultiMembershipSetting: {
      allowed: boolean;
      rootOrgName: string;
    } | null;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    const result = await getOrganizationDetailsUseCase.execute({
      organizationId,
      userId: user?.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    const org = result.value.organization;

    // For child orgs, fetch root's multi-membership setting
    let rootOrgMultiMembershipSetting: {
      allowed: boolean;
      rootOrgName: string;
    } | null = null;

    if (org.parentId) {
      const allowed =
        await organizationRepository.getRootAllowMultiTreeMembership(
          organizationId
        );
      const ancestorIds =
        await organizationRepository.getAncestorIds(organizationId);
      const rootId =
        ancestorIds.length > 0
          ? ancestorIds[ancestorIds.length - 1]
          : organizationId;
      const rootOrg = await organizationRepository.findById(rootId);

      rootOrgMultiMembershipSetting = {
        allowed,
        rootOrgName: rootOrg?.name ?? '',
      };
    }

    return {
      success: true,
      data: {
        organization: {
          id: org.id,
          name: org.name,
          description: org.description,
          parentId: org.parentId,
          allowMultiTreeMembership: org.allowMultiTreeMembership,
          createdAt: org.createdAt,
        },
        boards: result.value.boards.map((b) => ({
          id: b.board.id,
          name: b.board.name,
          memberCount: b.memberCount,
          members: b.members,
          isUserMember: b.isUserMember,
        })),
        isUserMember: result.value.isUserMember,
        isUserAdmin: result.value.isUserAdmin,
        firstAdmin: result.value.firstAdmin,
        ancestors: result.value.ancestors,
        hierarchyTree: result.value.hierarchyTree,
        rootOrgMultiMembershipSetting,
      },
    };
  } catch (error) {
    console.error('Error getting organization details:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getOrganizationPendingRequestsAction(
  organizationId: string,
  page?: number,
  pageSize?: number
): Promise<
  ActionResult<{
    requests: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      requestedAt: Date;
    }>;
    totalCount: number;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await getOrganizationPendingRequestsUseCase.execute({
      organizationId,
      adminUserId: user.id,
      page,
      pageSize,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: {
        requests: result.value.requests,
        totalCount: result.value.totalCount,
      },
    };
  } catch (error) {
    console.error('Error getting organization pending requests:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function cancelJoinRequestAction(
  organizationId: string
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const validation = CancelJoinRequestSchema.safeParse({
      organizationId,
      userId: user.id,
    });

    if (!validation.success) {
      return {
        success: false,
        error: t('validationFailed'),
      };
    }

    const result = await cancelJoinRequestUseCase.execute(validation.data);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return {
      success: true,
      data: undefined,
    };
  } catch (error) {
    console.error('Error cancelling join request:', error);

    return {
      success: false,
      error: t('generic'),
    };
  }
}

export async function getUserMemberOrganizationsAction(): Promise<
  ActionResult<Array<{ id: string; name: string }>>
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

    // Get direct memberships
    const memberships = await organizationRepository.findMembershipsByUserId(
      user.id
    );

    // For each, get ancestor orgs
    const allOrgIds = new Set<string>();
    const orgMap = new Map<string, string>();

    for (const org of memberships) {
      if (org.isArchived()) {
        continue;
      }

      allOrgIds.add(org.id);
      orgMap.set(org.id, org.name);

      const ancestorIds = await organizationRepository.getAncestorIds(org.id);

      for (const ancestorId of ancestorIds) {
        if (!allOrgIds.has(ancestorId)) {
          allOrgIds.add(ancestorId);
          const ancestor = await organizationRepository.findById(ancestorId);

          if (ancestor && !ancestor.isArchived()) {
            orgMap.set(ancestor.id, ancestor.name);
          }
        }
      }
    }

    const orgs = Array.from(orgMap.entries()).map(([id, name]) => ({
      id,
      name,
    }));

    return { success: true, data: orgs };
  } catch (error) {
    console.error('Error getting user member organizations:', error);

    return { success: false, error: t('generic') };
  }
}

export async function archiveOrganizationAction(
  organizationId: string
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

    const validation = ArchiveOrganizationSchema.safeParse({ organizationId });

    if (!validation.success) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await archiveOrganizationUseCase.execute({
      organizationId: validation.data.organizationId,
      adminUserId: user.id,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error archiving organization:', error);

    return { success: false, error: t('generic') };
  }
}

export async function unarchiveOrganizationAction(
  organizationId: string
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

    const validation = UnarchiveOrganizationSchema.safeParse({
      organizationId,
    });

    if (!validation.success) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await unarchiveOrganizationUseCase.execute({
      organizationId: validation.data.organizationId,
      adminUserId: user.id,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error unarchiving organization:', error);

    return { success: false, error: t('generic') };
  }
}

export async function searchAllOrganizationsAction(
  input: SearchOrganizationsInput
): Promise<
  ActionResult<{
    organizations: Array<{
      id: string;
      name: string;
      description: string;
      memberCount: number;
      firstAdmin: {
        id: string;
        firstName: string;
        lastName: string;
        middleName: string | null;
      } | null;
      parentOrg: { id: string; name: string } | null;
      archivedAt: Date | null;
    }>;
    totalCount: number;
  }>
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

    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

    if (!isSuperAdmin) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await organizationRepository.searchOrganizationsWithStats({
      ...input,
      includeArchived: true,
    });

    return {
      success: true,
      data: {
        organizations: result.organizations.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          memberCount: item.memberCount,
          firstAdmin: item.firstAdmin,
          parentOrg: item.parentOrg,
          archivedAt: item.organization.archivedAt,
        })),
        totalCount: result.totalCount,
      },
    };
  } catch (error) {
    console.error('Error searching all organizations:', error);

    return { success: false, error: t('generic') };
  }
}

export async function updateOrganizationAction(
  formData: FormData
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

    const organizationId = formData.get('organizationId') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const allowMultiTreeMembershipRaw = formData.get(
      'allowMultiTreeMembership'
    );
    const allowMultiTreeMembership =
      allowMultiTreeMembershipRaw !== null
        ? allowMultiTreeMembershipRaw === 'true'
        : undefined;

    // Validate with Zod (catches profanity with field-level errors)
    const validation = updateOrganizationSchema(profanityChecker).safeParse({
      organizationId,
      name: name || '',
      description: description || '',
      allowMultiTreeMembership,
    });

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues
      );

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    const result = await updateOrganizationUseCase.execute({
      organizationId: validation.data.organizationId,
      userId: user.id,
      name: validation.data.name,
      description: validation.data.description,
      allowMultiTreeMembership: validation.data.allowMultiTreeMembership,
    });

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error updating organization:', error);

    return { success: false, error: t('generic') };
  }
}

export async function removeOrgAdminAction(
  organizationId: string,
  targetUserId: string
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

    const result = await removeOrgAdminUseCase.execute({
      organizationId,
      targetUserId,
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
    console.error('Error removing org admin:', error);

    return { success: false, error: t('generic') };
  }
}

export async function getOrgAdminsPaginatedAction(
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

    const useCase = new GetOrgAdminsPaginatedUseCase({
      prisma,
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
      return { success: false as const, error: t('unexpected') };
    }

    return { success: true as const, data: result.value };
  } catch (error) {
    console.error('Error fetching org admins paginated:', error);

    return { success: false as const, error: t('unexpected') };
  }
}

export async function searchOrganizationsForJoinParentAction(
  query: string,
  excludeIds: string[]
): Promise<ActionResult<Array<{ id: string; name: string }>>> {
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

    const result = await searchOrganizationsUseCase.execute({
      query,
      excludeIds,
      limit: 20,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: result.value };
  } catch (error) {
    console.error('Error searching organizations for join parent:', error);

    return { success: false, error: t('generic') };
  }
}

type UserSearchResult = Array<{
  id: string;
  firstName: string;
  lastName: string;
  middleName?: string;
  nickname: string;
  address?: { city: string; street: string };
}>;

async function searchOrgUsers(
  organizationId: string,
  query: string,
  opts: {
    scope: 'members' | 'non-members';
    excludeAdmins?: boolean;
  }
): Promise<ActionResult<UserSearchResult>> {
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

    if (!query || query.trim().length < 2) {
      return { success: true, data: [] };
    }

    // Check authorization
    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);
    const isAdmin = await organizationRepository.isUserAdmin(
      user.id,
      organizationId
    );

    if (!isAdmin && !isSuperAdmin) {
      return { success: false, error: t('unauthorized') };
    }

    // Search users: members are visible to each other, non-members respect privacy
    const respectPrivacy = opts.scope === 'non-members';
    const users = await userRepository.searchUsers(query.trim(), {
      respectPrivacy,
    });

    // Optionally exclude existing admins (used when inviting new admins)
    let adminIdSet = new Set<string>();

    if (opts.excludeAdmins) {
      const adminIds =
        await organizationRepository.findAdminUserIds(organizationId);
      adminIdSet = new Set(adminIds);
    }

    // Get org member IDs
    const orgMembers = await prisma.organizationUser.findMany({
      where: {
        organizationId,
        status: 'accepted',
      },
      select: { userId: true },
    });
    const memberIdSet = new Set(orgMembers.map((m) => m.userId));

    const filteredUsers = users
      .filter((u) => !adminIdSet.has(u.id))
      .filter((u) => {
        if (opts.scope === 'members') {
          return memberIdSet.has(u.id);
        }

        return !memberIdSet.has(u.id);
      })
      .map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        middleName: u.middleName,
        nickname: u.nickname.getValue(),
        address:
          u.allowFindByAddress && u.address
            ? { city: u.address.city, street: u.address.street }
            : undefined,
      }));

    return { success: true, data: filteredUsers };
  } catch (error) {
    console.error('Error searching users:', error);

    return { success: false, error: t('generic') };
  }
}

export async function searchUsersForMemberInviteAction(
  organizationId: string,
  query: string
): Promise<ActionResult<UserSearchResult>> {
  return searchOrgUsers(organizationId, query, { scope: 'non-members' });
}

export async function searchUsersForAdminInviteAction(
  organizationId: string,
  query: string,
  scope: 'members' | 'non-members'
): Promise<ActionResult<UserSearchResult>> {
  return searchOrgUsers(organizationId, query, {
    scope,
    excludeAdmins: true,
  });
}

export async function getRootMultiMembershipInfoAction(
  orgId: string
): Promise<ActionResult<{ allowed: boolean; rootOrgName: string }>> {
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

    const allowed =
      await organizationRepository.getRootAllowMultiTreeMembership(orgId);

    const ancestorIds = await organizationRepository.getAncestorIds(orgId);
    const rootId =
      ancestorIds.length > 0 ? ancestorIds[ancestorIds.length - 1] : orgId;
    const rootOrg = await organizationRepository.findById(rootId);

    return {
      success: true,
      data: {
        allowed,
        rootOrgName: rootOrg?.name ?? '',
      },
    };
  } catch (error) {
    console.error('Error getting root multi-membership info:', error);

    return { success: false, error: t('generic') };
  }
}

/**
 * Search organizations by name for filter comboboxes.
 * Superadmins search all orgs; regular users search their member/admin orgs.
 * Returns lightweight {id, name}[] — max 20 results.
 */
export async function searchOrganizationsForFilterAction(input: {
  query: string;
}): Promise<ActionResult<Array<{ id: string; name: string }>>> {
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

    if (input.query.length < 2) {
      return { success: true, data: [] };
    }

    const isSuperAdmin = await userRepository.isSuperAdmin(user.id);

    const orgs = await prisma.organization.findMany({
      where: {
        name: { contains: input.query, mode: 'insensitive' },
        archivedAt: null,
        ...(!isSuperAdmin && {
          OR: [
            {
              members: {
                some: { userId: user.id, status: 'accepted' },
              },
            },
            { admins: { some: { userId: user.id } } },
          ],
        }),
      },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
      take: 20,
    });

    return { success: true, data: orgs };
  } catch (error) {
    console.error('Error searching organizations for filter:', error);

    return { success: false, error: t('generic') };
  }
}

export async function leaveOrganizationAction(
  formData: FormData
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

    const organizationId = formData.get('organizationId') as string;
    const boardIdsJson = formData.get('boardIdsToLeave') as string;

    if (!organizationId) {
      return { success: false, error: t('validationFailed') };
    }

    const boardIdsToLeave: string[] = boardIdsJson
      ? JSON.parse(boardIdsJson)
      : [];

    const result = await leaveOrganizationUseCase.execute({
      userId: user.id,
      organizationId,
      boardIdsToLeave,
    });

    if (!result.success) {
      return { success: false, error: await translateErrorCode(result.error) };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error leaving organization:', error);

    return { success: false, error: t('generic') };
  }
}
