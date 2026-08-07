import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { PrismaUserRepository } from '../PrismaUserRepository';
import { AddressIntegrityLogger } from '@/infrastructure/address/AddressIntegrityLogger';
import { User } from '@/domain/user/User';
import { PhoneNumber } from '@/domain/user/PhoneNumber';
import { Nickname } from '@/domain/user/Nickname';
import { Address } from '@/domain/user/Address';
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

// --- save() write path: undefined vs null ---------------------------------
//
// Prisma treats `undefined` in an upsert payload as "leave this column
// alone" — only `null` writes NULL. Address.create() normalizes cleared
// optional fields to `undefined` (see Address.ts), so PrismaUserRepository
// must coalesce with `?? null` before handing the payload to Prisma, or a
// field the user cleared in the UI silently keeps its old DB value while
// the action still reports success. These tests assert on the exact payload
// passed to the mocked `prisma.user.upsert`, since that's the only place
// this distinction is visible.

function buildUser(address: Address | undefined, id = 'user-1'): User {
  return User.reconstitute({
    id,
    firstName: 'Иван',
    lastName: 'Иванов',
    phoneNumber: PhoneNumber.create('+79001234567'),
    password: 'hash',
    language: 'ru',
    createdAt: new Date(),
    nickname: Nickname.create('ivanov'),
    address,
  });
}

function repoWithUpsert(returnRow: unknown) {
  const upsert = vi.fn().mockResolvedValue(returnRow);
  const prisma = {
    user: { upsert },
  } as unknown as PrismaClient;

  return { repo: new PrismaUserRepository(prisma), upsert };
}

describe('PrismaUserRepository address persistence — save()', () => {
  it('writes postalCode: null, not undefined, when a cleared postal code is saved (reported bug)', async () => {
    const address = Address.create({
      country: 'Россия',
      region: 'Ростовская обл',
      city: 'Ростов-на-Дону',
      street: 'Гвардейский пер',
      building: '13',
      apartment: '5',
      postalCode: '', // cleared in the form
      isPrivateHouse: false,
    });

    const { repo, upsert } = repoWithUpsert(
      userRow({ ...baseAddress, apartment: '5' })
    );

    await repo.save(buildUser(address));

    const payload = upsert.mock.calls[0][0];
    const updatePayload = payload.update.address.upsert.update;

    expect(updatePayload.postalCode).toBeNull();
    expect(updatePayload.postalCode).not.toBeUndefined();
  });

  it('writes apartment: null and flatFiasId: null for a private house (dangerous variant — contradictory pair)', async () => {
    const address = Address.create({
      country: 'Россия',
      city: 'Ростов-на-Дону',
      street: 'Гвардейский пер',
      building: '13',
      isPrivateHouse: true,
      // Address.create forces apartment/flatFiasId to undefined whenever
      // isPrivateHouse is true, regardless of what was submitted — that
      // domain rule is what produces the undefined this test guards against.
    });

    const { repo, upsert } = repoWithUpsert(
      userRow({
        ...baseAddress,
        apartment: null,
        isPrivateHouse: true,
        oneLine: null,
        houseFiasId: null,
        flatFiasId: null,
      })
    );

    await repo.save(buildUser(address));

    const payload = upsert.mock.calls[0][0];
    const updatePayload = payload.update.address.upsert.update;

    expect(updatePayload.apartment).toBeNull();
    expect(updatePayload.apartment).not.toBeUndefined();
    expect(updatePayload.flatFiasId).toBeNull();
    expect(updatePayload.flatFiasId).not.toBeUndefined();
  });

  it('still writes the real values for a populated address (normal path not broken)', async () => {
    const address = Address.create({
      country: 'Россия',
      region: 'Ростовская обл',
      city: 'Ростов-на-Дону',
      street: 'Гвардейский пер',
      building: '13',
      apartment: '42',
      postalCode: '344011',
      isPrivateHouse: false,
      oneLine:
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13, кв 42',
      houseFiasId: 'c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5',
      flatFiasId: '9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee',
    });

    const { repo, upsert } = repoWithUpsert(
      userRow({ ...baseAddress, apartment: '42' })
    );

    await repo.save(buildUser(address));

    const payload = upsert.mock.calls[0][0];

    // All three field-list blocks are populated on every save() call that
    // carries an address (see save()'s create/upsert.create/upsert.update),
    // so this one call proves the coalescing is consistent across all three.
    for (const block of [
      payload.create.address.create,
      payload.update.address.upsert.create,
      payload.update.address.upsert.update,
    ]) {
      expect(block.region).toBe('Ростовская обл');
      expect(block.apartment).toBe('42');
      expect(block.postalCode).toBe('344011');
      expect(block.oneLine).toBe(
        '344011, Ростовская обл, г Ростов-на-Дону, Гвардейский пер, д 13, кв 42'
      );
      expect(block.houseFiasId).toBe('c1bfc52f-e9a7-4d67-a1bd-b418f495d3f5');
      expect(block.flatFiasId).toBe('9d9d7e0a-e49f-4ebf-a962-00cfa892b1ee');
    }
  });
});
