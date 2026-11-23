/** Decodes stored settings and translates database exceptions into explicit port failures.
 * Missing rows stay distinct from invalid persisted values and failed reads. */
import type { PrismaClient } from '@/generated/prisma/client';
import type { SystemSettingRepository } from '@/domain/systemSetting/SystemSettingRepository';
import {
  SystemSetting,
  SystemSettingKey,
  decodeStoredSetting,
} from '@/domain/systemSetting/SystemSetting';
import { failure, success } from '@/domain/shared/Result';

export class PrismaSystemSettingRepository implements SystemSettingRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async get(key: SystemSettingKey): ReturnType<SystemSettingRepository['get']> {
    let setting: { key: string; value: string } | null;

    try {
      setting = await this.prisma.systemSetting.findUnique({ where: { key } });
    } catch {
      return failure('common.errors.unexpected');
    }

    if (setting === null) {
      return success(null);
    }

    const decoded = decodeStoredSetting(setting.key, setting.value);

    if (!decoded.success || decoded.value.key !== key) {
      return failure('common.errors.unexpected');
    }

    return decoded;
  }
  async set(input: SystemSetting): ReturnType<SystemSettingRepository['set']> {
    const parsed = SystemSetting.safeParse(input);

    if (!parsed.success) {
      return failure('common.errors.validationFailed');
    }

    const setting = parsed.data;
    const value = String(setting.value);

    try {
      await this.prisma.systemSetting.upsert({
        where: { key: setting.key },
        create: { key: setting.key, value },
        update: { value },
      });
    } catch {
      return failure('common.errors.unexpected');
    }

    return success(undefined);
  }
}
