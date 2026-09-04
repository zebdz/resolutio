import { describe, it, expect, vi } from 'vitest';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { EmailAddress } from '@/domain/user/EmailAddress';
import type { PrismaClient } from '@/generated/prisma/client';

function buildRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    firstName: 'Ivan',
    lastName: 'Ivanov',
    middleName: null,
    phoneNumber: '+79161234567',
    password: 'hash',
    language: 'ru',
    consentGivenAt: null,
    createdAt: new Date('2026-01-01'),
    nickname: 'ivan_ivanov',
    allowFindByName: false,
    allowFindByPhone: false,
    allowFindByAddress: false,
    privacySetupCompleted: false,
    confirmedAt: null,
    address: null,
    email: null,
    emailConfirmedAt: null,
    ...overrides,
  };
}

describe('PrismaUserRepository email mapping', () => {
  it('maps a stored email and its confirmation into the domain object', async () => {
    const prisma = {
      user: {
        findUnique: vi.fn().mockResolvedValue(
          buildRow({
            email: 'ivan@mail.ru',
            emailConfirmedAt: new Date('2026-02-01'),
          })
        ),
      },
    } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findById('user-1');

    expect(user?.email?.getValue()).toBe('ivan@mail.ru');
    expect(user?.hasConfirmedEmail()).toBe(true);
  });

  it('maps a null email to undefined', async () => {
    const prisma = {
      user: { findUnique: vi.fn().mockResolvedValue(buildRow()) },
    } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findById('user-1');

    expect(user?.email).toBeUndefined();
    expect(user?.hasConfirmedEmail()).toBe(false);
  });

  it('looks a user up by normalized email', async () => {
    const findFirst = vi
      .fn()
      .mockResolvedValue(buildRow({ email: 'ivan@mail.ru' }));
    const prisma = { user: { findFirst } } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findByEmail(
      EmailAddress.create('IVAN@MAIL.RU')
    );

    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ivan@mail.ru' } })
    );
    expect(user?.id).toBe('user-1');
  });

  it('returns null when no user has that email', async () => {
    const prisma = {
      user: { findFirst: vi.fn().mockResolvedValue(null) },
    } as unknown as PrismaClient;

    const user = await new PrismaUserRepository(prisma).findByEmail(
      EmailAddress.create('nobody@mail.ru')
    );

    expect(user).toBeNull();
  });
});
