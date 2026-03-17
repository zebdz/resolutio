'use server';

import { getTranslations } from 'next-intl/server';
import { UpdateUserProfileUseCase } from '@/src/application/user/UpdateUserProfileUseCase';
import { CompletePrivacySetupUseCase } from '@/src/application/user/CompletePrivacySetupUseCase';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { UpdateUserProfileSchema } from '@/src/application/user/UpdateUserProfileSchema';
import { CompletePrivacySetupSchema } from '@/src/application/user/CompletePrivacySetupSchema';
import { getCurrentUser } from '../lib/session';
import {
  checkRateLimit,
  checkPhoneSearchRateLimit,
  recordFailedPhoneSearch,
} from '@/web/actions/rateLimit';
import { Locale } from '@/src/i18n/locales';
import { revalidatePath } from 'next/cache';
import { translateZodFieldErrors } from '@/web/actions/utils/translateZodErrors';
import { translateErrorCode } from '@/web/actions/utils/translateErrorCode';
import {
  NICKNAME_MIN_LENGTH,
  NICKNAME_MAX_LENGTH,
} from '@/src/domain/user/Nickname';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const userRepository = new PrismaUserRepository(prisma);
const updateUserProfileUseCase = new UpdateUserProfileUseCase(userRepository);
const completePrivacySetupUseCase = new CompletePrivacySetupUseCase(
  userRepository
);

export async function updateProfileAction(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations();

  try {
    // Get current user
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return {
        success: false,
        error: t('common.errors.unauthorized'),
      };
    }

    // Extract form data
    const languageValue = formData.get('language');
    const nicknameValue = formData.get('nickname');
    const allowFindByNameValue = formData.get('allowFindByName');
    const allowFindByPhoneValue = formData.get('allowFindByPhone');

    const input = {
      userId: currentUser.id,
      language: languageValue ? (languageValue as Locale) : undefined,
      nickname: nicknameValue ? String(nicknameValue) : undefined,
      allowFindByName:
        allowFindByNameValue !== null
          ? allowFindByNameValue === 'true'
          : undefined,
      allowFindByPhone:
        allowFindByPhoneValue !== null
          ? allowFindByPhoneValue === 'true'
          : undefined,
    };

    // Validate with Zod
    const validation = UpdateUserProfileSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues,
        { minLength: NICKNAME_MIN_LENGTH, maxLength: NICKNAME_MAX_LENGTH }
      );

      return {
        success: false,
        error: t('common.errors.validationFailed'),
        fieldErrors,
      };
    }

    // Execute use case
    const result = await updateUserProfileUseCase.execute(validation.data);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    // Revalidate the account page
    revalidatePath('/account');

    return {
      success: true,
      data: { message: t('account.updateSuccess') },
    };
  } catch (error) {
    console.error('Update profile action error:', error);

    return {
      success: false,
      error: t('common.errors.unexpected'),
    };
  }
}

export async function completePrivacySetupAction(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations();

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: t('common.errors.unauthorized') };
    }

    const nicknameValue = formData.get('nickname');
    const allowFindByNameValue = formData.get('allowFindByName');
    const allowFindByPhoneValue = formData.get('allowFindByPhone');

    const input = {
      userId: currentUser.id,
      nickname: nicknameValue ? String(nicknameValue) : undefined,
      allowFindByName: allowFindByNameValue === 'true',
      allowFindByPhone: allowFindByPhoneValue === 'true',
    };

    const validation = CompletePrivacySetupSchema.safeParse(input);

    if (!validation.success) {
      const fieldErrors = await translateZodFieldErrors(
        validation.error.issues,
        { minLength: NICKNAME_MIN_LENGTH, maxLength: NICKNAME_MAX_LENGTH }
      );

      return {
        success: false,
        error: t('common.errors.validationFailed'),
        fieldErrors,
      };
    }

    const result = await completePrivacySetupUseCase.execute(validation.data);

    if (!result.success) {
      return {
        success: false,
        error: await translateErrorCode(result.error),
      };
    }

    revalidatePath('/');

    return {
      success: true,
      data: { message: t('privacySetup.success') },
    };
  } catch (error) {
    console.error('Complete privacy setup action error:', error);

    return { success: false, error: t('common.errors.unexpected') };
  }
}

export async function searchUserByPhoneAction(phone: string): Promise<
  ActionResult<{
    id: string;
    firstName: string;
    lastName: string;
    middleName?: string;
    nickname: string;
  } | null>
> {
  const rateLimited = await checkRateLimit();

  if (rateLimited) {
    return rateLimited;
  }

  const t = await getTranslations('common.errors');

  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return { success: false, error: t('unauthorized') };
    }

    const phoneRateLimited = await checkPhoneSearchRateLimit(currentUser.id);

    if (phoneRateLimited) {
      return phoneRateLimited;
    }

    if (!phone || phone.trim().length < 2) {
      return { success: true, data: null };
    }

    const user = await userRepository.searchUserByPhone(phone.trim());

    if (!user) {
      // Record failed attempt for rate limiting
      await recordFailedPhoneSearch(currentUser.id);

      return { success: true, data: null };
    }

    return {
      success: true,
      data: {
        id: user.id,
        firstName: user.firstName,
        lastName: user.lastName,
        middleName: user.middleName,
        nickname: user.nickname.getValue(),
      },
    };
  } catch (error) {
    console.error('Search user by phone action error:', error);

    return { success: false, error: t('generic') };
  }
}
