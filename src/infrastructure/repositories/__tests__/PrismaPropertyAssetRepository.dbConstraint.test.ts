// Integration test against a real Postgres connection. Verifies that the
// partial unique index on `property_asset_ownerships`
//   (asset_id, user_id) WHERE effective_until IS NULL AND user_id IS NOT NULL
// (migration 20260427142323) actually rejects duplicate active rows for the
// same registered user on the same asset.
//
// Why this test must hit the real DB: the constraint is a Postgres-side
// invariant. Mocked-Prisma tests (PrismaPropertyAssetRepository.test.ts)
// confirm that we *translate* P2002 into our domain error code, but they
// can't confirm Postgres actually fires P2002 in the first place. If the
// migration ever gets dropped or rewritten incorrectly, only a real-DB
// test catches it.
//
// The test is gated on DATABASE_URL — skipped silently in environments
// where no DB is available, so it doesn't break unrelated CI runs.
//
// Isolation: every fixture row created here is deleted in `afterAll` so
// the DB is left exactly as it was found.

import 'dotenv/config';
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';

const HAS_DB = Boolean(process.env.DATABASE_URL);

describe.skipIf(!HAS_DB)(
  'PrismaPropertyAssetRepository — DB unique constraint on (asset, user) active rows',
  () => {
    let prisma: PrismaClient;
    let pool: pg.Pool;
    // Every fixture row is recorded here so cleanup never strands data.
    const cleanup: Array<() => Promise<unknown>> = [];

    beforeAll(async () => {
      pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
      const adapter = new PrismaPg(pool);
      prisma = new PrismaClient({ adapter });
    });

    afterAll(async () => {
      // Run cleanups in reverse order (child rows before parents). Each
      // is wrapped in try/catch so a single failure doesn't leak others.
      for (let i = cleanup.length - 1; i >= 0; i--) {
        try {
          await cleanup[i]();
        } catch {
          // Ignore — cascade may have already removed the row.
        }
      }

      await prisma.$disconnect();
      await pool.end();
    });

    it('rejects a second active ownership row for the same (asset, user) with P2002', async () => {
      // 1) Build a self-contained fixture chain: User → Organization →
      //    OrganizationProperty → PropertyAsset. Using a fresh chain avoids
      //    accidentally polluting real org data.
      const stamp = `dbtest-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const user = await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: `+7900${Date.now().toString().slice(-7)}`,
          password: 'test',
          nickname: stamp,
        },
      });
      cleanup.push(() => prisma.user.delete({ where: { id: user.id } }));

      const org = await prisma.organization.create({
        data: {
          name: `${stamp}-org`,
          description: 'integration-test fixture',
          createdById: user.id,
        },
      });
      cleanup.push(() => prisma.organization.delete({ where: { id: org.id } }));

      const property = await prisma.organizationProperty.create({
        data: {
          organizationId: org.id,
          name: `${stamp}-prop`,
          sizeUnit: 'SQUARE_METERS',
        },
      });
      cleanup.push(() =>
        prisma.organizationProperty.delete({ where: { id: property.id } })
      );

      const asset = await prisma.propertyAsset.create({
        data: {
          propertyId: property.id,
          name: `${stamp}-asset`,
          size: '1',
        },
      });
      cleanup.push(() =>
        prisma.propertyAsset.delete({ where: { id: asset.id } })
      );

      // 2) Insert the FIRST active ownership row. Should succeed.
      const first = await prisma.propertyAssetOwnership.create({
        data: {
          assetId: asset.id,
          userId: user.id,
          externalOwnerLabel: null,
          share: '0.50000000',
        },
      });
      cleanup.push(() =>
        prisma.propertyAssetOwnership.delete({ where: { id: first.id } })
      );
      expect(first.id).toBeTruthy();

      // 3) Attempt the duplicate. The DB MUST reject — that's the whole
      //    point of the constraint. If this somehow succeeds, the test
      //    fails loudly because the regression is real.
      let caught: any = null;

      try {
        const dup = await prisma.propertyAssetOwnership.create({
          data: {
            assetId: asset.id,
            userId: user.id,
            externalOwnerLabel: null,
            share: '0.50000000',
          },
        });
        // If we reach this line, the constraint didn't fire — register
        // for cleanup so the test environment isn't left dirty.
        cleanup.push(() =>
          prisma.propertyAssetOwnership.delete({ where: { id: dup.id } })
        );
      } catch (e) {
        caught = e;
      }

      expect(caught, 'duplicate insert was not rejected').not.toBeNull();
      expect(caught.code).toBe('P2002');
      // Prisma 7 with the driver adapter (PrismaPg) puts the violated
      // index name in `meta.driverAdapterError.cause.originalMessage` —
      // NOT in `meta.target` (that lived in older Prisma surfaces only).
      // This pins the test to our specific index so an unrelated unique
      // constraint firing wouldn't satisfy it.
      const originalMessage =
        (
          caught.meta as
            | {
                driverAdapterError?: {
                  cause?: { originalMessage?: string };
                };
              }
            | undefined
        )?.driverAdapterError?.cause?.originalMessage ?? '';
      expect(originalMessage).toContain(
        'property_asset_ownerships_active_user_unique'
      );
    });

    it('allows multiple ACTIVE external-owner placeholders on the same asset (user_id IS NULL is exempt)', async () => {
      // Sanity: the constraint must NOT block legitimate multi-external
      // configurations. The migration's WHERE clause specifically excludes
      // user_id IS NULL — verify that here so a future rewrite that drops
      // the WHERE clause is caught.
      const stamp = `dbtest2-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const user = await prisma.user.create({
        data: {
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: `+7900${(Date.now() + 1).toString().slice(-7)}`,
          password: 'test',
          nickname: stamp,
        },
      });
      cleanup.push(() => prisma.user.delete({ where: { id: user.id } }));

      const org = await prisma.organization.create({
        data: {
          name: `${stamp}-org`,
          description: 'integration-test fixture',
          createdById: user.id,
        },
      });
      cleanup.push(() => prisma.organization.delete({ where: { id: org.id } }));

      const property = await prisma.organizationProperty.create({
        data: {
          organizationId: org.id,
          name: `${stamp}-prop`,
          sizeUnit: 'SQUARE_METERS',
        },
      });
      cleanup.push(() =>
        prisma.organizationProperty.delete({ where: { id: property.id } })
      );

      const asset = await prisma.propertyAsset.create({
        data: {
          propertyId: property.id,
          name: `${stamp}-asset`,
          size: '1',
        },
      });
      cleanup.push(() =>
        prisma.propertyAsset.delete({ where: { id: asset.id } })
      );

      const ext1 = await prisma.propertyAssetOwnership.create({
        data: {
          assetId: asset.id,
          userId: null,
          externalOwnerLabel: 'Иванов',
          share: '0.50000000',
        },
      });
      cleanup.push(() =>
        prisma.propertyAssetOwnership.delete({ where: { id: ext1.id } })
      );

      // The duplicate-on-userId-NULL case must NOT fire P2002 — placeholders
      // are deliberately allowed to repeat.
      const ext2 = await prisma.propertyAssetOwnership.create({
        data: {
          assetId: asset.id,
          userId: null,
          externalOwnerLabel: 'Петров',
          share: '0.50000000',
        },
      });
      cleanup.push(() =>
        prisma.propertyAssetOwnership.delete({ where: { id: ext2.id } })
      );
      expect(ext1.id).not.toBe(ext2.id);
    });
  }
);
