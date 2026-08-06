import { vi, describe, it, expect } from 'vitest';
import { PrismaUserRepository } from '../PrismaUserRepository';
import type { PrismaClient } from '@/generated/prisma';

// Minimal row shaped like USER_SELECT; only address matters here
function userRow(address: Record<string, unknown> | null) {
  return {
    id: 'user-1',
    firstName: 'Иван',
    lastName: 'Иванов',
    middleName: null,
    phoneNumber: '+79001234567',
    password: 'hash',
    language: 'ru',
    consentGivenAt: new Date(),
    createdAt: new Date(),
    nickname: 'ivanov', // NICKNAME_MIN_LENGTH is 5; 'ivan' (4 chars) fails Nickname.create
    allowFindByName: true,
    allowFindByPhone: true,
    allowFindByAddress: true,
    privacySetupCompleted: true,
    confirmedAt: new Date(),
    address,
  };
}

const baseAddress = {
  id: 'addr-1',
  country: 'Россия',
  region: 'Ростовская обл',
  city: 'Ростов-на-Дону',
  street: 'Гвардейский пер',
  building: '13',
  postalCode: '344011',
};

function repoReturning(row: unknown) {
  const prisma = {
    user: { findUnique: vi.fn().mockResolvedValue(row) },
  } as unknown as PrismaClient;

  return new PrismaUserRepository(prisma);
}

describe('PrismaUserRepository address reconstitution', () => {
  it('loads a private house with no apartment without throwing', async () => {
    // The exact shape the Task 1 backfill produces for legacy rows
    const repo = repoReturning(
      userRow({
        ...baseAddress,
        apartment: null,
        isPrivateHouse: true,
        oneLine: null,
        houseFiasId: null,
        flatFiasId: null,
      })
    );

    const user = await repo.findById('user-1');

    expect(user?.address?.isPrivateHouse).toBe(true);
    expect(user?.address?.apartment).toBeUndefined();
  });

  it('maps ГАР provenance through reconstitution', async () => {
    const repo = repoReturning(
      userRow({
        ...baseAddress,
        apartment: '2',
        isPrivateHouse: false,
        oneLine:
          '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13, кв 2',
        houseFiasId: 'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
        flatFiasId: '9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee',
      })
    );

    const user = await repo.findById('user-1');

    expect(user?.address?.apartment).toBe('2');
    expect(user?.address?.oneLine).toContain('кв 2');
    expect(user?.address?.houseFiasId).toBe(
      'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5'
    );
    expect(user?.address?.flatFiasId).toBe(
      '9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee'
    );
  });
});
