import { describe, it, expect, vi } from 'vitest';
import { PrismaOtpRepository } from '../PrismaOtpRepository';
import { OtpPurposes, OtpVerification } from '@/domain/otp/OtpVerification';
import type { PrismaClient } from '@/generated/prisma/client';

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'otp-1',
    identifier: 'ivan@mail.ru',
    channel: 'email',
    purpose: 'password_reset',
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

describe('PrismaOtpRepository purpose', () => {
  it('persists the purpose on save', async () => {
    const create = vi.fn().mockResolvedValue(buildRow());
    const prisma = { otpVerification: { create } } as unknown as PrismaClient;

    await new PrismaOtpRepository(prisma).save(
      OtpVerification.create({
        identifier: 'ivan@mail.ru',
        channel: 'email',
        purpose: OtpPurposes.PASSWORD_RESET,
        code: 'hashed',
        clientIp: '127.0.0.1',
        expiresAt: new Date(Date.now() + 600_000),
        userId: 'user-1',
      })
    );

    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ purpose: 'password_reset' }),
      })
    );
  });

  it('maps the purpose back into the domain object', async () => {
    const prisma = {
      otpVerification: { findUnique: vi.fn().mockResolvedValue(buildRow()) },
    } as unknown as PrismaClient;

    const otp = await new PrismaOtpRepository(prisma).findById('otp-1');

    expect(otp?.purpose).toBe('password_reset');
  });

  // The replay guard: a lookup for one purpose must never see another's rows.
  it('filters findLatestByIdentifier on purpose', async () => {
    const findFirst = vi.fn().mockResolvedValue(buildRow());
    const prisma = {
      otpVerification: { findFirst },
    } as unknown as PrismaClient;

    await new PrismaOtpRepository(prisma).findLatestByIdentifier(
      'ivan@mail.ru',
      'email',
      OtpPurposes.PASSWORD_RESET
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          identifier: 'ivan@mail.ru',
          channel: 'email',
          purpose: 'password_reset',
        },
      })
    );
  });

  it('filters countRecentByIdentifier on purpose', async () => {
    const count = vi.fn().mockResolvedValue(2);
    const prisma = { otpVerification: { count } } as unknown as PrismaClient;

    const result = await new PrismaOtpRepository(
      prisma
    ).countRecentByIdentifier(
      'ivan@mail.ru',
      'email',
      OtpPurposes.EMAIL_CONFIRMATION,
      24
    );

    expect(result).toBe(2);
    expect(count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          identifier: 'ivan@mail.ru',
          channel: 'email',
          purpose: 'email_confirmation',
        }),
      })
    );
  });
});
