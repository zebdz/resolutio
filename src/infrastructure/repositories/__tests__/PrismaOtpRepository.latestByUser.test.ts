import { describe, it, expect, vi } from 'vitest';
import { PrismaOtpRepository } from '../PrismaOtpRepository';
import { OtpPurposes } from '@/domain/otp/OtpVerification';
import type { PrismaClient } from '@/generated/prisma/client';

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'otp-1',
    identifier: '+79161234567',
    channel: 'sms',
    purpose: 'phone_confirmation',
    code: 'hashed',
    clientIp: '127.0.0.1',
    userId: 'user-1',
    attempts: 0,
    maxAttempts: 5,
    expiresAt: new Date(Date.now() + 600_000),
    verifiedAt: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  };
}

describe('PrismaOtpRepository.findLatestByUserId', () => {
  it('returns the newest code minted for the user for that purpose', async () => {
    const findFirst = vi.fn().mockResolvedValue(buildRow());
    const prisma = {
      otpVerification: { findFirst },
    } as unknown as PrismaClient;

    const otp = await new PrismaOtpRepository(prisma).findLatestByUserId(
      'user-1',
      OtpPurposes.PHONE_CONFIRMATION
    );

    expect(findFirst).toHaveBeenCalledWith({
      where: { userId: 'user-1', purpose: 'phone_confirmation' },
      orderBy: { createdAt: 'desc' },
    });
    expect(otp?.id).toBe('otp-1');
    expect(otp?.userId).toBe('user-1');
  });

  it('returns null when the user has no code for that purpose', async () => {
    const prisma = {
      otpVerification: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const otp = await new PrismaOtpRepository(prisma).findLatestByUserId(
      'user-1',
      OtpPurposes.PHONE_CONFIRMATION
    );

    expect(otp).toBeNull();
  });
});
