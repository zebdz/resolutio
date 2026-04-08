import type { PrismaClient } from '@/generated/prisma/client';
import type { SystemSettingRepository } from '@/domain/systemSetting/SystemSettingRepository';

export class PrismaSystemSettingRepository implements SystemSettingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string): Promise<string | null> {
    const setting = await this.prisma.systemSetting.findUnique({
      where: { key },
    });

    return setting?.value ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    await this.prisma.systemSetting.upsert({
      where: { key },
      create: { key, value },
      update: { value },
    });
  }
}
