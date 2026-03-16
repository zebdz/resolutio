'use server';

import { getTranslations } from 'next-intl/server';
import { getCurrentUser } from '../lib/session';
import { checkRateLimit } from '@/web/actions/rateLimit';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import type { ActionResult } from '@/web/actions/organization';
import {
  prisma,
  PrismaOrganizationRepository,
  PrismaUserRepository,
  PrismaJoinTokenRepository,
  PrismaInvitationRepository,
  PrismaNotificationRepository,
} from '@/infrastructure/index';
import { CreateJoinTokenUseCase } from '@/application/organization/CreateJoinTokenUseCase';
import { CreateJoinTokenSchema } from '@/application/organization/CreateJoinTokenSchema';
import { ExpireJoinTokenUseCase } from '@/application/organization/ExpireJoinTokenUseCase';
import { ReactivateJoinTokenUseCase } from '@/application/organization/ReactivateJoinTokenUseCase';
import { UpdateJoinTokenMaxUsesUseCase } from '@/application/organization/UpdateJoinTokenMaxUsesUseCase';
import { UpdateJoinTokenMaxUsesSchema } from '@/application/organization/UpdateJoinTokenMaxUsesSchema';
import { GetJoinTokensByOrgUseCase } from '@/application/organization/GetJoinTokensByOrgUseCase';
import { UseJoinTokenUseCase } from '@/application/organization/UseJoinTokenUseCase';
import { JoinOrganizationUseCase } from '@/application/organization/JoinOrganizationUseCase';

// Initialize dependencies
const organizationRepository = new PrismaOrganizationRepository(prisma);
const userRepository = new PrismaUserRepository(prisma);
const joinTokenRepository = new PrismaJoinTokenRepository(prisma);
const invitationRepository = new PrismaInvitationRepository(prisma);
const notificationRepository = new PrismaNotificationRepository(prisma);

// Use cases
const createJoinTokenUseCase = new CreateJoinTokenUseCase({
  organizationRepository,
  joinTokenRepository,
  userRepository,
});

const expireJoinTokenUseCase = new ExpireJoinTokenUseCase({
  joinTokenRepository,
  organizationRepository,
  userRepository,
});

const reactivateJoinTokenUseCase = new ReactivateJoinTokenUseCase({
  joinTokenRepository,
  organizationRepository,
  userRepository,
});

const updateJoinTokenMaxUsesUseCase = new UpdateJoinTokenMaxUsesUseCase({
  joinTokenRepository,
  organizationRepository,
  userRepository,
});

const getJoinTokensByOrgUseCase = new GetJoinTokensByOrgUseCase({
  organizationRepository,
  joinTokenRepository,
  userRepository,
});

const joinOrganizationUseCase = new JoinOrganizationUseCase({
  organizationRepository,
  invitationRepository,
  notificationRepository,
  userRepository,
  prisma,
});

const useJoinTokenUseCase = new UseJoinTokenUseCase({
  joinTokenRepository,
  organizationRepository,
  joinOrganizationUseCase,
});

function translateErrorCode(
  errorKey: string,
  tJoinToken: any,
  tOrg: any,
  tDomain: any
): string {
  if (errorKey.startsWith('joinToken.errors.')) {
    return tJoinToken(errorKey.replace('joinToken.', '') as any);
  }

  if (errorKey.startsWith('organization.errors.')) {
    return tOrg(errorKey.replace('organization.', '') as any);
  }

  if (errorKey.startsWith('domain.joinToken.')) {
    return tDomain(errorKey.replace('domain.', '') as any);
  }

  return errorKey;
}

export async function createJoinTokenAction(
  formData: FormData
): Promise<ActionResult<{ tokenId: string; token: string }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tJoinToken = await getTranslations('joinToken');
  const tOrg = await getTranslations('organization');
  const tDomain = await getTranslations('domain');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const maxUsesRaw = formData.get('maxUses') as string;
    const input = {
      organizationId: formData.get('organizationId') as string,
      description: formData.get('description') as string,
      maxUses: maxUsesRaw ? parseInt(maxUsesRaw, 10) : null,
    };

    const validation = CreateJoinTokenSchema.safeParse(input);

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

    const result = await createJoinTokenUseCase.execute(
      validation.data,
      user.id
    );

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tJoinToken, tOrg, tDomain),
      };
    }

    return {
      success: true,
      data: {
        tokenId: result.value.id,
        token: result.value.token,
      },
    };
  } catch (error) {
    console.error('Error creating join token:', error);

    return { success: false, error: t('generic') };
  }
}

export async function expireJoinTokenAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tJoinToken = await getTranslations('joinToken');
  const tOrg = await getTranslations('organization');
  const tDomain = await getTranslations('domain');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const tokenId = formData.get('tokenId') as string;

    if (!tokenId) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await expireJoinTokenUseCase.execute(tokenId, user.id);

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tJoinToken, tOrg, tDomain),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error expiring join token:', error);

    return { success: false, error: t('generic') };
  }
}

export async function reactivateJoinTokenAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tJoinToken = await getTranslations('joinToken');
  const tOrg = await getTranslations('organization');
  const tDomain = await getTranslations('domain');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const tokenId = formData.get('tokenId') as string;

    if (!tokenId) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await reactivateJoinTokenUseCase.execute(tokenId, user.id);

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tJoinToken, tOrg, tDomain),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error reactivating join token:', error);

    return { success: false, error: t('generic') };
  }
}

export async function updateJoinTokenMaxUsesAction(
  formData: FormData
): Promise<ActionResult> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tJoinToken = await getTranslations('joinToken');
  const tOrg = await getTranslations('organization');
  const tDomain = await getTranslations('domain');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const maxUsesRaw = formData.get('maxUses') as string;
    const input = {
      tokenId: formData.get('tokenId') as string,
      maxUses: maxUsesRaw ? parseInt(maxUsesRaw, 10) : null,
    };

    const validation = UpdateJoinTokenMaxUsesSchema.safeParse(input);

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

    const result = await updateJoinTokenMaxUsesUseCase.execute(
      validation.data,
      user.id
    );

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tJoinToken, tOrg, tDomain),
      };
    }

    return { success: true, data: undefined };
  } catch (error) {
    console.error('Error updating join token max uses:', error);

    return { success: false, error: t('generic') };
  }
}

export async function getJoinTokensByOrgAction(
  organizationId: string,
  search?: string,
  page?: number,
  pageSize?: number,
  activeOnly?: boolean
): Promise<
  ActionResult<{
    tokens: Array<{
      id: string;
      organizationId: string;
      token: string;
      description: string;
      maxUses: number | null;
      useCount: number;
      createdById: string;
      createdAt: Date;
      expiredAt: Date | null;
      creatorName: string;
    }>;
    totalCount: number;
  }>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tJoinToken = await getTranslations('joinToken');
  const tOrg = await getTranslations('organization');
  const tDomain = await getTranslations('domain');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const result = await getJoinTokensByOrgUseCase.execute(
      { organizationId, search, page, pageSize, activeOnly },
      user.id
    );

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tJoinToken, tOrg, tDomain),
      };
    }

    const serializedTokens = result.value.tokens.map(
      ({ joinToken, creatorName }) => ({
        ...joinToken.toJSON(),
        creatorName,
      })
    );

    return {
      success: true,
      data: {
        tokens: serializedTokens,
        totalCount: result.value.totalCount,
      },
    };
  } catch (error) {
    console.error('Error getting join tokens:', error);

    return { success: false, error: t('generic') };
  }
}

export async function joinViaTokenAction(
  formData: FormData
): Promise<ActionResult<{ organizationId: string }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');
  const tJoinToken = await getTranslations('joinToken');
  const tOrg = await getTranslations('organization');
  const tDomain = await getTranslations('domain');

  try {
    const user = await getCurrentUser();

    if (!user) {
      return { success: false, error: t('unauthorized') };
    }

    const tokenValue = formData.get('token') as string;

    if (!tokenValue) {
      return { success: false, error: t('validationFailed') };
    }

    const result = await useJoinTokenUseCase.execute(tokenValue, user.id);

    if (!result.success) {
      return {
        success: false,
        error: translateErrorCode(result.error, tJoinToken, tOrg, tDomain),
      };
    }

    return {
      success: true,
      data: { organizationId: result.value.organizationId },
    };
  } catch (error) {
    console.error('Error joining via token:', error);

    return { success: false, error: t('generic') };
  }
}
