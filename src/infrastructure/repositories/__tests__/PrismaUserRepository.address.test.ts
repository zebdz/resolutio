import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { AddressIntegrityLogger } from '@/infrastructure/address/AddressIntegrityLogger';
import type { PrismaClient } from '@/generated/prisma';

// Minimal row shaped like USER_SELECT; only address (and, for the list
// tests below, id) matters here
function userRow(
  address: Record<string, unknown> | null,
  overrides: Partial<{ id: string }> = {}
) {
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
    ...overrides,
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

// A row shaped exactly like the deploy-write-window failure mode described
// in readmes/2026-08-06-address-dadata-design.md ("Accepted risk"): old code
// wrote the column default is_private_house = false with a NULL apartment.
// Address.create() throws APARTMENT_REQUIRED when this row is reconstituted.
const badAddress = {
  ...baseAddress,
  apartment: null,
  isPrivateHouse: false,
  oneLine: null,
  houseFiasId: null,
  flatFiasId: null,
};

const goodAddress = {
  ...baseAddress,
  apartment: '2',
  isPrivateHouse: false,
  oneLine: null,
  houseFiasId: null,
  flatFiasId: null,
};

function repoReturningMany(rows: unknown[], logger: AddressIntegrityLogger) {
  const prisma = {
    user: { findMany: vi.fn().mockResolvedValue(rows) },
  } as unknown as PrismaClient;

  return new PrismaUserRepository(prisma, logger);
}

describe('PrismaUserRepository list reconstitution — searchUsers vs findByIds', () => {
  let dir: string;
  let logger: AddressIntegrityLogger;

  beforeEach(async () => {
    dir = await fs.mkdtemp(path.join(os.tmpdir(), 'addr-integrity-repo-'));
    logger = new AddressIntegrityLogger(dir);
  });

  afterEach(async () => {
    await fs.rm(dir, { recursive: true, force: true });
  });

  async function readIntegrityLog(): Promise<Record<string, unknown>[]> {
    const raw = await fs.readFile(
      path.join(dir, 'address-integrity.log'),
      'utf8'
    );

    return raw
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((l) => JSON.parse(l));
  }

  it('searchUsers returns the good users, omits the bad one, and logs it', async () => {
    const rows = [
      userRow(goodAddress, { id: 'user-good-1' }),
      userRow(badAddress, { id: 'user-bad' }),
      userRow(goodAddress, { id: 'user-good-2' }),
    ];

    const repo = repoReturningMany(rows, logger);

    const users = await repo.searchUsers('и');

    expect(users.map((u) => u.id)).toEqual(['user-good-1', 'user-good-2']);

    const [entry] = await readIntegrityLog();

    expect(entry.level).toBe('error');
    expect(entry.event).toBe('unreadable_address');
    expect(entry.userId).toBe('user-bad');
    expect(entry.reason).toBe('domain.user.address.apartmentRequired');
    expect(entry.method).toBe('searchUsers');
  });

  it('findByIds still throws on a bad row — this asymmetry with searchUsers is deliberate (see toDomainSkippingInvalid in PrismaUserRepository)', async () => {
    const rows = [
      userRow(goodAddress, { id: 'user-good-1' }),
      userRow(badAddress, { id: 'user-bad' }),
    ];

    const repo = repoReturningMany(rows, logger);

    await expect(repo.findByIds(['user-good-1', 'user-bad'])).rejects.toThrow(
      'domain.user.address.apartmentRequired'
    );
  });
});
