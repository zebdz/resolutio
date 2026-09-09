import { describe, it, expect, vi } from 'vitest';
import { PrismaOtpRepository } from '../PrismaOtpRepository';
import type { PrismaClient } from '@/generated/prisma/client';

describe('PrismaOtpRepository deleteAllForUser', () => {
  it('deletes every code issued to the user and reports how many', async () => {
    const deleteMany = vi.fn().mockResolvedValue({ count: 3 });
    const prisma = {
      otpVerification: { deleteMany },
    } as unknown as PrismaClient;

    const deleted = await new PrismaOtpRepository(prisma).deleteAllForUser(
      'user-1'
    );

    expect(deleted).toBe(3);
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
  });
});
