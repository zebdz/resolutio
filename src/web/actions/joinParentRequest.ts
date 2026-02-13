'use server';

import { getTranslations } from 'next-intl/server';
import { RequestJoinParentUseCase } from '@/application/organization/RequestJoinParentUseCase';
import { RequestJoinParentSchema } from '@/application/organization/RequestJoinParentSchema';
import { CancelJoinParentRequestUseCase } from '@/application/organization/CancelJoinParentRequestUseCase';
import { CancelJoinParentRequestSchema } from '@/application/organization/CancelJoinParentRequestSchema';
import { HandleJoinParentRequestUseCase } from '@/application/organization/HandleJoinParentRequestUseCase';
import { HandleJoinParentRequestSchema } from '@/application/organization/HandleJoinParentRequestSchema';
import { GetChildOrgJoinParentRequestUseCase } from '@/application/organization/GetChildOrgJoinParentRequestUseCase';
import { GetIncomingJoinParentRequestsUseCase } from '@/application/organization/GetIncomingJoinParentRequestsUseCase';
import { GetAllJoinParentRequestsUseCase } from '@/application/organization/GetAllJoinParentRequestsUseCase';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaJoinParentRequestRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { getCurrentUser } from '../lib/session';
import { ActionResult } from './organization';

// Initialize dependencies
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const joinParentRequestRepository = new PrismaJoinParentRequestRepository(
  prisma
);
const notificationRepository = new PrismaNotificationRepository(prisma);

// Use cases
const requestJoinParentUseCase = new RequestJoinParentUseCase({
  organizationRepository,
  joinParentRequestRepository,
  userRepository,
  notificationRepository,
});

const cancelJoinParentRequestUseCase = new CancelJoinParentRequestUseCase({
  joinParentRequestRepository,
  organizationRepository,
  userRepository,
});

const handleJoinParentRequestUseCase = new HandleJoinParentRequestUseCase({
  organizationRepository,
  joinParentRequestRepository,
  userRepository,
  notificationRepository,
});

const getChildOrgJoinParentRequestUseCase =
  new GetChildOrgJoinParentRequestUseCase({
    joinParentRequestRepository,
    organizationRepository,
    userRepository,
  });

const getIncomingJoinParentRequestsUseCase =
  new GetIncomingJoinParentRequestsUseCase({
    joinParentRequestRepository,
    organizationRepository,
    userRepository,
  });

const getAllJoinParentRequestsUseCase = new GetAllJoinParentRequestsUseCase({
  joinParentRequestRepository,
  organizationRepository,
  userRepository,
});

export async function requestJoinParentAction(
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');
  const tOrg = await getTranslations('organization');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const input = {
      childOrgId: formData.get('childOrgId') as string,
      parentOrgId: formData.get('parentOrgId') as string,
      adminUserId: user.id,
      message: formData.get('message') as string,
    };

    const validation = RequestJoinParentSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');

        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

      return { success: false, error: t('validationFailed'), fieldErrors };
    }

    const result = await requestJoinParentUseCase.execute(validation.data);

    if (!result.success) {
      const errorMessage = result.error.startsWith('organization.errors.')
        ? tOrg(result.error.replace('organization.', '') as any)
        : result.error;

      return { success: false, error: errorMessage };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error requesting join parent:', error);

    return { success: false, error: t('generic') };
  }
}

export async function cancelJoinParentRequestAction(
  requestId: string
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');
  const tOrg = await getTranslations('organization');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const validation = CancelJoinParentRequestSchema.safeParse({
      requestId,
      adminUserId: user.id,
    });

    if (!validation.success) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await cancelJoinParentRequestUseCase.execute(
      validation.data
    );

    if (!result.success) {
      const errorMessage = result.error.startsWith('organization.errors.')
        ? tOrg(result.error.replace('organization.', '') as any)
        : result.error;

      return { success: false, error: errorMessage };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error cancelling join parent request:', error);

    return { success: false, error: t('generic') };
  }
}

export async function handleJoinParentRequestAction(
  formData: FormData
): Promise<ActionResult> {
  const t = await getTranslations('common.errors');
  const tOrg = await getTranslations('organization');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const input = {
      requestId: formData.get('requestId') as string,
      adminUserId: user.id,
      action: formData.get('action') as 'accept' | 'reject',
      rejectionReason: (formData.get('rejectionReason') as string) || undefined,
    };

    const validation = HandleJoinParentRequestSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors: Record<string, string[]> = {};
      validation.error.issues.forEach((err) => {
        const path = err.path.join('.');

        if (!fieldErrors[path]) {
          fieldErrors[path] = [];
        }

        fieldErrors[path].push(err.message);
      });

      return { success: false, error: t('validationFailed'), fieldErrors };
    }

    const result = await handleJoinParentRequestUseCase.execute(
      validation.data
    );

    if (!result.success) {
      const errorMessage = result.error.startsWith('organization.errors.')
        ? tOrg(result.error.replace('organization.', '') as any)
        : result.error;

      return { success: false, error: errorMessage };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error handling join parent request:', error);

    return { success: false, error: t('generic') };
  }
}

export async function getChildOrgJoinParentRequestAction(
  childOrgId: string
): Promise<
  ActionResult<{
    request: {
      id: string;
      parentOrgId: string;
      parentOrgName: string;
      message: string;
      createdAt: Date;
    } | null;
  }>
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await getChildOrgJoinParentRequestUseCase.execute({
      childOrgId,
      adminUserId: user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    if (!result.value) {
      return { success: true, data: { request: null } };
    }

    // Resolve parent org name
    const parentOrg = await organizationRepository.findById(
      result.value.parentOrgId
    );

    return {
      success: true,
      data: {
        request: {
          id: result.value.id,
          parentOrgId: result.value.parentOrgId,
          parentOrgName: parentOrg?.name ?? 'Unknown',
          message: result.value.message,
          createdAt: result.value.createdAt,
        },
      },
    };
  } catch (error) {
    console.error('Error getting child org join parent request:', error);

    return { success: false, error: t('generic') };
  }
}

export async function getIncomingJoinParentRequestsAction(
  parentOrgId: string
): Promise<
  ActionResult<{
    requests: Array<{
      id: string;
      childOrgId: string;
      childOrgName: string;
      requestingAdminName: string;
      message: string;
      createdAt: Date;
    }>;
  }>
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await getIncomingJoinParentRequestsUseCase.execute({
      parentOrgId,
      adminUserId: user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Resolve child org names and requesting admin names
    const requests = await Promise.all(
      result.value.map(async (req) => {
        const childOrg = await organizationRepository.findById(req.childOrgId);
        const admin = await userRepository.findById(req.requestingAdminId);

        return {
          id: req.id,
          childOrgId: req.childOrgId,
          childOrgName: childOrg?.name ?? 'Unknown',
          requestingAdminName: admin
            ? `${admin.firstName} ${admin.lastName}`
            : 'Unknown',
          message: req.message,
          createdAt: req.createdAt,
        };
      })
    );

    return { success: true, data: { requests } };
  } catch (error) {
    console.error('Error getting incoming join parent requests:', error);

    return { success: false, error: t('generic') };
  }
}

export interface EnrichedJoinParentRequest {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  childOrgId: string;
  childOrgName: string;
  parentOrgId: string;
  parentOrgName: string;
  requestingAdminName: string;
  handlingAdminName: string | null;
  message: string;
  rejectionReason: string | null;
  createdAt: Date;
  handledAt: Date | null;
}

export async function getAllJoinParentRequestsAction(
  organizationId: string
): Promise<
  ActionResult<{
    incoming: EnrichedJoinParentRequest[];
    outgoing: EnrichedJoinParentRequest[];
  }>
> {
  const t = await getTranslations('common.errors');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await getAllJoinParentRequestsUseCase.execute({
      organizationId,
      adminUserId: user.id,
    });

    if (!result.success) {
      return { success: false, error: result.error };
    }

    // Collect all unique user IDs and org IDs for batch lookup
    const allRequests = [...result.value.incoming, ...result.value.outgoing];
    const userIds = new Set<string>();
    const orgIds = new Set<string>();

    for (const req of allRequests) {
      userIds.add(req.requestingAdminId);

      if (req.handlingAdminId) {
        userIds.add(req.handlingAdminId);
      }

      orgIds.add(req.childOrgId);
      orgIds.add(req.parentOrgId);
    }

    // Batch fetch users and orgs
    const users = await userRepository.findByIds(Array.from(userIds));
    const userMap = new Map(users.map((u) => [u.id, u]));

    const orgEntries = await Promise.all(
      Array.from(orgIds).map(async (id) => {
        const org = await organizationRepository.findById(id);

        return [id, org] as const;
      })
    );
    const orgMap = new Map(orgEntries);

    const enrich = (
      req: (typeof allRequests)[0]
    ): EnrichedJoinParentRequest => {
      const requestingAdmin = userMap.get(req.requestingAdminId);
      const handlingAdmin = req.handlingAdminId
        ? userMap.get(req.handlingAdminId)
        : null;
      const childOrg = orgMap.get(req.childOrgId);
      const parentOrg = orgMap.get(req.parentOrgId);

      return {
        id: req.id,
        status: req.status,
        childOrgId: req.childOrgId,
        childOrgName: childOrg?.name ?? 'Unknown',
        parentOrgId: req.parentOrgId,
        parentOrgName: parentOrg?.name ?? 'Unknown',
        requestingAdminName: requestingAdmin
          ? `${requestingAdmin.firstName} ${requestingAdmin.lastName}`
          : 'Unknown',
        handlingAdminName: handlingAdmin
          ? `${handlingAdmin.firstName} ${handlingAdmin.lastName}`
          : null,
        message: req.message,
        rejectionReason: req.rejectionReason,
        createdAt: req.createdAt,
        handledAt: req.handledAt,
      };
    };

    return {
      success: true,
      data: {
        incoming: result.value.incoming.map(enrich),
        outgoing: result.value.outgoing.map(enrich),
      },
    };
  } catch (error) {
    console.error('Error getting all join parent requests:', error);

    return { success: false, error: t('generic') };
  }
}
