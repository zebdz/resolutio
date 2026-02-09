'use server';

import { redirect } from 'next/navigation';
import { getTranslations } from 'next-intl/server';
import { CreateOrganizationUseCase } from '@/application/organization/CreateOrganizationUseCase';
import { CreateOrganizationSchema } from '@/application/organization/CreateOrganizationSchema';
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
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaBoardRepository,
  PrismaUserRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../lib/session';

// Action result type for client-side handling
export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const organizationRepository = new PrismaOrganizationRepository(prisma);
const boardRepository = new PrismaBoardRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);

// Use cases
const createOrganizationUseCase = new CreateOrganizationUseCase({
  organizationRepository,
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
  userRepository,
});

const joinOrganizationUseCase = new JoinOrganizationUseCase({
  organizationRepository,
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

export async function createOrganizationAction(
  formData: FormData
): Promise<ActionResult<{ organizationId: string }>> {
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

    // Return success with organization ID
    return {
      success: true,
      data: {
        organizationId: result.value.organization.id,
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
      firstAdmin: { id: string; firstName: string; lastName: string } | null;
    }>;
  }>
> {
  const t = await getTranslations('common.errors');

  try {
    // Get current user to filter out their memberships
    const user = await getCurrentUser();

    const result = await listOrganizationsUseCase.execute(user?.id);

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

export async function joinOrganizationAction(
  formData: FormData
): Promise<ActionResult> {
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
    }>;
  }>
> {
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

    return {
      success: true,
      data: {
        organizations: result.value.organizations.map((org) => ({
          id: org.id,
          name: org.name,
        })),
      },
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
    }>;
    pending: Array<{
      id: string;
      name: string;
      description: string;
      requestedAt: Date;
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
      };
    }>;
  }>
> {
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
        })),
        pending: result.value.pending.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          requestedAt: item.requestedAt,
        })),
        rejected: result.value.rejected.map((item) => ({
          id: item.organization.id,
          name: item.organization.name,
          description: item.organization.description,
          rejectedAt: item.rejectedAt,
          rejectionReason: item.rejectionReason,
          rejectedBy: item.rejectedBy,
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

export async function getPendingRequestsAction(): Promise<
  ActionResult<{
    requests: Array<{
      organizationId: string;
      organizationName: string;
      requester: {
        id: string;
        firstName: string;
        lastName: string;
        phoneNumber: string;
      };
      requestedAt: Date;
    }>;
  }>
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    const result = await getPendingRequestsUseCase.execute(user.id);

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
      isUserMember: boolean;
    }>;
    isUserMember: boolean;
    isUserAdmin: boolean;
    firstAdmin: { id: string; firstName: string; lastName: string } | null;
  }>
> {
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
        error: result.error,
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
          isUserMember: b.isUserMember,
        })),
        isUserMember: result.value.isUserMember,
        isUserAdmin: result.value.isUserAdmin,
        firstAdmin: result.value.firstAdmin,
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
  organizationId: string
): Promise<
  ActionResult<{
    requests: Array<{
      userId: string;
      firstName: string;
      lastName: string;
      middleName?: string;
      phoneNumber: string;
      requestedAt: Date;
    }>;
  }>
> {
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
