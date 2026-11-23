/** Real PostgreSQL round trips protect the migration's size/share precision contract.
 * Only the disposable schema is written; domain values are saved and reloaded through the adapter. */
import { afterAll, beforeAll, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { pollDatabase } from './pollDatabase';
import { PrismaPropertyAssetRepository } from '../PrismaPropertyAssetRepository';
import { PropertyAsset } from '@/domain/organization/PropertyAsset';
import {
  AssetSize,
  AssetName,
  OwnershipShare,
  ExternalOwnerLabel,
} from '@/domain/organization/PropertyValues';
import { AssetId, PropertyId, OwnershipId } from '@/domain/shared/EntityIds';
import { Instant } from '@/domain/shared/Instant';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';

let db: Awaited<ReturnType<typeof pollDatabase>>;
beforeAll(async () => {
  db = await pollDatabase();
}, 30_000);
afterAll(async () => {
  await db?.close();
});

it('round-trips six-place sizes and eight-place shares, preserving zero and supplied identity/time', async () => {
  const stamp = randomUUID();
  const user = await db.prisma.user.create({
    data: {
      firstName: 'Test',
      lastName: 'Owner',
      phoneNumber: stamp,
      nickname: stamp,
      password: 'test',
    },
  });
  const organization = await db.prisma.organization.create({
    data: {
      name: stamp,
      description: 'Disposable decimal fixture',
      createdById: user.id,
    },
  });
  const property = await db.prisma.organizationProperty.create({
    data: {
      organizationId: organization.id,
      name: 'Building',
      sizeUnit: 'SQUARE_METERS',
    },
  });
  const repository = new PrismaPropertyAssetRepository(db.prisma);
  const now = Instant.parse('2026-11-10T12:34:56.789Z');

  for (const [size, share] of [
    [0.000001, 0],
    [123.456789, 0.00000001],
    [999999999.999999, 0.12345678],
    [1, 1],
  ]) {
    const asset = expectSuccess(
      PropertyAsset.create(
        PropertyId.parse(property.id),
        AssetName.parse('Unit'),
        AssetSize.parse(size),
        { id: AssetId.parse(randomUUID()), now }
      )
    );
    const saved = expectSuccess(await repository.saveAsset(asset));
    expect(saved.id).toBe(asset.id);
    expect(saved.size).toBe(size);
    expect(saved.createdAt.toISOString()).toBe(now);

    const ownerId = OwnershipId.parse(randomUUID());
    expectSuccess(
      await repository.replaceOwners({
        assetId: asset.id,
        at: now,
        inserts: [
          {
            id: ownerId,
            owner: {
              kind: 'external',
              label: ExternalOwnerLabel.parse('First owner'),
            },
            share: OwnershipShare.parse(share),
            createdAt: now,
          },
          {
            id: OwnershipId.parse(randomUUID()),
            owner: {
              kind: 'external',
              label: ExternalOwnerLabel.parse('Second owner'),
            },
            share: OwnershipShare.parse(1 - share),
            createdAt: now,
          },
        ],
      })
    );
    const owners = expectSuccess(
      await repository.findActiveOwnershipForAsset(asset.id)
    );
    const owner = owners.find((candidate) => candidate.id === ownerId);
    expect(owner?.share).toBe(share);
    expect(owner?.effectiveFrom.toISOString()).toBe(now);
    expect(owner?.createdAt.toISOString()).toBe(now);

    const storedAsset = await db.prisma.propertyAsset.findUniqueOrThrow({
      where: { id: asset.id },
    });
    const storedOwner =
      await db.prisma.propertyAssetOwnership.findUniqueOrThrow({
        where: { id: ownerId },
      });
    expect(storedAsset.size.toFixed(6)).toBe(size.toFixed(6));
    expect(storedOwner.share.toFixed(8)).toBe(share.toFixed(8));
  }
});
