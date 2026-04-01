'use server';

import { getTranslations } from 'next-intl/server';
import { UpdateUserProfileUseCase } from '@/src/application/user/UpdateUserProfileUseCase';
import { CompletePrivacySetupUseCase } from '@/src/application/user/CompletePrivacySetupUseCase';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { updateUserProfileSchema } from '@/src/application/user/UpdateUserProfileSchema';
import { completePrivacySetupSchema } from '@/src/application/user/CompletePrivacySetupSchema';
import { getCurrentUser } from '../../lib/session';
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
import { LeoProfanityChecker } from '@/infrastructure/profanity/LeoProfanityChecker';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const userRepository = new PrismaUserRepository(prisma);
const profanityChecker = LeoProfanityChecker.getInstance();
const updateUserProfileUseCase = new UpdateUserProfileUseCase(
  userRepository,
  profanityChecker
);
const completePrivacySetupUseCase = new CompletePrivacySetupUseCase(
  userRepository,
  profanityChecker
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

    const allowFindByAddressValue = formData.get('allowFindByAddress');

    // Address fields — present when user submits the address form
    const addressCountry = formData.get('addressCountry');
    const addressAction = formData.get('addressAction'); // 'save' | 'clear' | absent

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
      allowFindByAddress:
        allowFindByAddressValue !== null
          ? allowFindByAddressValue === 'true'
          : undefined,
      address:
        addressAction === 'clear'
          ? null
          : addressCountry
            ? {
                country: String(formData.get('addressCountry')),
                region: formData.get('addressRegion')
                  ? String(formData.get('addressRegion'))
                  : undefined,
                city: String(formData.get('addressCity')),
                street: String(formData.get('addressStreet')),
                building: String(formData.get('addressBuilding')),
                apartment: formData.get('addressApartment')
                  ? String(formData.get('addressApartment'))
                  : undefined,
                postalCode: formData.get('addressPostalCode')
                  ? String(formData.get('addressPostalCode'))
                  : undefined,
              }
            : undefined,
    };

    // Validate with Zod
    const validation =
      updateUserProfileSchema(profanityChecker).safeParse(input);

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
    const allowFindByAddressValue = formData.get('allowFindByAddress');

    const input = {
      userId: currentUser.id,
      nickname: nicknameValue ? String(nicknameValue) : undefined,
      allowFindByName: allowFindByNameValue === 'true',
      allowFindByPhone: allowFindByPhoneValue === 'true',
      allowFindByAddress: allowFindByAddressValue === 'true',
    };

    const validation =
      completePrivacySetupSchema(profanityChecker).safeParse(input);

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
