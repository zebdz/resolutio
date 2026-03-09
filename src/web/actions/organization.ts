'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CreateOrganizationUseCase } from '@/application/organization/CreateOrganizationUseCase';
import { CreateOrganizationSchema } from '@/application/organization/CreateOrganizationSchema';
import { ArchiveOrganizationUseCase } from '@/application/organization/ArchiveOrganizationUseCase';
import { ArchiveOrganizationSchema } from '@/application/organization/ArchiveOrganizationSchema';
import { UnarchiveOrganizationUseCase } from '@/application/organization/UnarchiveOrganizationUseCase';
import { UnarchiveOrganizationSchema } from '@/application/organization/UnarchiveOrganizationSchema';
import { ListOrganizationsUseCase } from '@/application/organization/ListOrganizationsUseCase';
import { GetAdminOrganizationsUseCase } from '@/application/organization/GetAdminOrganizationsUseCase';
import { GetUserOrganizationsUseCase } from '@/application/organization/GetUserOrganizationsUseCase';
import { GetPendingRequestsUseCase } from '@/application/organization/GetPendingRequestsUseCase';
import { HandleJoinRequestUseCase } from '@/application/organization/HandleJoinRequestUseCase';
import { HandleJoinRequestSchema } from '@/application/organization/HandleJoinRequestSchema';
import { JoinOrganizationUseCase } from '@/application/organization/JoinOrganizationUseCase';
import { JoinOrganizationSchema } from '@/application/organization/JoinOrganizationSchema';
import { GetOrganizationDetailsUseCase } from '@/application/organization/GetOrganizationDetailsUseCase';
import { GetOrganizationPendingRequestsUseCase } from '@/application/organization/GetOrganizationPendingRequestsUseCase';
import { CancelJoinRequestUseCase } from '@/application/organization/CancelJoinRequestUseCase';
import { CancelJoinRequestSchema } from '@/application/organization/CancelJoinRequestSchema';
import { UpdateOrganizationUseCase } from '@/application/organization/UpdateOrganizationUseCase';
import { AddOrgAdminUseCase } from '@/application/organization/AddOrgAdminUseCase';
import { RemoveOrgAdminUseCase } from '@/application/organization/RemoveOrgAdminUseCase';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { Notification } from '@/domain/notification/Notification';
import { getCurrentUser } from '../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const organizationRepository = new PrismaOrganizationRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);

// Use cases
const createOrganizationUseCase = new CreateOrganizationUseCase({
  organizationRepository,
  userRepository,
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
});

const addOrgAdminUseCase = new AddOrgAdminUseCase({
  organizationRepository,
  userRepository,
});

const removeOrgAdminUseCase = new RemoveOrgAdminUseCase({
  organizationRepository,
  userRepository,
});

export async function createOrganizationAction(
  formData: FormData
): Promise<ActionResult<{ organizationId: string; autoJoinFailed?: boolean }>> {
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
      name: formData.get('name') as string,
      description: formData.get('description') as string,
      parentId: (formData.get('parentId') as string) || null,
      autoJoin: formData.get('autoJoin') !== 'false',
    };

    // Validate with Zod
    const validation = CreateOrganizationSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');

        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

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
      // Translate error code to localized message
      const errorMessage = result.error.startsWith('organization.errors.')
        ? tOrg(result.error.replace('organization.', '') as any)
        : result.error;

      return {
        success: false,
        error: errorMessage,
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
    // Get current user to filter out their memberships
    const user = await getCurrentUser();

    const result = await listOrganizationsUseCase.execute({}, user?.id);

    if (!result.success) {
      return {
        success: false,
        error: result.error,
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

export async function searchOrganizationsAction(
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
      return { success: false, error: result.error };
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
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');

        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

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
      // Translate error code to localized message
      const errorMessage = result.error.startsWith('organization.errors.')
        ? tOrg(result.error.replace('organization.', '') as any)
        : result.error;

      return {
        success: false,
        error: errorMessage,
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
        error: 'You have already requested to join this organization',
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
        error: result.error,
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
        error: result.error,
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
        error: result.error,
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
  const tOrg = await getTranslations('organization');

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

    const validation = HandleJoinRequestSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');

        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

      return {
        success: false,
        error: t('validationFailed'),
        fieldErrors,
      };
    }

    const result = await handleJoinRequestUseCase.execute(validation.data);

    if (!result.success) {
      // Translate error code to localized message
      const errorMessage = result.error.startsWith('organization.errors.')
        ? tOrg(result.error.replace('organization.', '') as any)
        : result.error;

      return {
        success: false,
        error: errorMessage,
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
      const errorParts = result.error.split('.');
      const tError = await getTranslations(errorParts.shift());

      return {
        success: false,
        error: tError(errorParts.join('.')),
      };
    }

    return {
      success: true,
      data: {
        organization: {
          id: result.value.organization.id,
          name: result.value.organization.name,
          description: result.value.organization.description,
          createdAt: result.value.organization.createdAt,
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
        error: result.error,
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
  const tOrg = await getTranslations('organization');

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
      const errorMessage = result.error.startsWith('organization.errors.')
        ? tOrg(result.error.replace('organization.', '') as any)
        : result.error;

      return {
        success: false,
        error: errorMessage,
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
      const errorParts = result.error.split('.');
      const tError = await getTranslations(errorParts.shift());

      return { success: false, error: tError(errorParts.join('.')) };
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
      const errorParts = result.error.split('.');
      const tError = await getTranslations(errorParts.shift());

      return { success: false, error: tError(errorParts.join('.')) };
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

function translateErrorCode(errorCode: string, tOrg: any): string {
  if (errorCode.startsWith('organization.errors.')) {
    return tOrg(errorCode.replace('organization.', '') as any);
  }

  if (errorCode.startsWith('domain.organization.')) {
    return tOrg(errorCode.replace('domain.organization.', 'errors.') as any);
  }

  return errorCode;
}

export async function updateOrganizationAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tOrg = await getTranslations('organization');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const organizationId = formData.get('organizationId') as string;
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;

    if (!organizationId) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await updateOrganizationUseCase.execute({
      organizationId,
      userId: user.id,
      name: name || '',
      description: description || '',
    });

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tOrg),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error updating organization:', error);

    return { success: false, error: t('generic') };
  }
}

export async function addOrgAdminAction(
  organizationId: string,
  targetUserId: string
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tOrg = await getTranslations('organization');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await addOrgAdminUseCase.execute({
      organizationId,
      targetUserId,
      actorUserId: user.id,
    });

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tOrg),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error adding org admin:', error);

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
  const tOrg = await getTranslations('organization');

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
        error: translateErrorCode(result.error, tOrg),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error removing org admin:', error);

    return { success: false, error: t('generic') };
  }
}

export async function getOrgAdminsAction(organizationId: string): Promise<
  ActionResult<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      middleName?: string;
    }>
  >
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

    const adminIds =
      await organizationRepository.findAdminUserIds(organizationId);
    const adminUsers = await userRepository.findByIds(adminIds);

    return {
      success: true,
      data: adminUsers.map((u) => ({
        id: u.id,
        firstName: u.firstName,
        lastName: u.lastName,
        middleName: u.middleName,
      })),
    };
  } catch (error) {
    console.error('Error getting org admins:', error);

    return { success: false, error: t('generic') };
  }
}

export async function searchUsersForOrgAdminAction(
  organizationId: string,
  query: string,
  scope: 'members' | 'non-members'
): Promise<
  ActionResult<
    Array<{
      id: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      nickname: string;
    }>
  >
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
    const respectPrivacy = scope === 'non-members';
    const users = await userRepository.searchUsers(query.trim(), {
      respectPrivacy,
    });

    // Get current admin IDs to exclude
    const adminIds =
      await organizationRepository.findAdminUserIds(organizationId);
    const adminIdSet = new Set(adminIds);

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
      .filter((u) => !adminIdSet.has(u.id)) // exclude existing admins
      .filter((u) => {
        if (scope === 'members') {
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
      }));

    return { success: true, data: filteredUsers };
  } catch (error) {
    console.error('Error searching users for org admin:', error);

    return { success: false, error: t('generic') };
  }
}
