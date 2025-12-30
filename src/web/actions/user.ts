'use server';

import { getTranslations } from 'next-intl/server';
import { UpdateUserProfileUseCase } from '@/src/application/user/UpdateUserProfileUseCase';
import { prisma, PrismaUserRepository } from '@/infrastructure/index';
import { UpdateUserProfileSchema } from '@/src/application/user/UpdateUserProfileSchema';
import { getCurrentUser } from '../lib/session';
import { Locale } from '@/src/i18n/locales';
import { revalidatePath } from 'next/cache';

export type ActionResult<T = void> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

// Initialize dependencies
const userRepository = new PrismaUserRepository(prisma);
const updateUserProfileUseCase = new UpdateUserProfileUseCase(userRepository);

export async function updateProfileAction(
  formData: FormData
): Promise<ActionResult<{ message: string }>> {
  const t = await getTranslations('common.errors');

  try {
    // Get current user
    const currentUser = await getCurrentUser();
    if (!currentUser) {
      return {
        success: false,
        error: t('unauthorized'),
      };
    }

    // Extract form data
    const languageValue = formData.get('language');

    const input = {
      userId: currentUser.id,
      language: languageValue ? (languageValue as Locale) : undefined,
    };

    // Validate with Zod
    const validation = UpdateUserProfileSchema.safeParse(input);
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
    const result = await updateUserProfileUseCase.execute(validation.data);

    if (!result.success) {
      return {
        success: false,
        error: result.error.message,
      };
    }

    // Revalidate the account page
    revalidatePath('/account');

    return {
      success: true,
      data: { message: 'Profile updated successfully' },
    };
  } catch (error) {
    console.error('Update profile action error:', error);

    return {
      success: false,
      error: t('unexpected'),
    };
  }
}
