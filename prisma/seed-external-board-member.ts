import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import pg from 'pg';
import { hash } from '@node-rs/argon2';

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const ARGON2_OPTIONS = {
  memoryCost: 19456,
  timeCost: 2,
  outputLen: 32,
  parallelism: 1,
};

/**
 * Creates an external board member: a user who belongs to boards
 * but is NOT a member of their parent organizations.
 *
 * Run: npx tsx prisma/seed-external-board-member.ts
 *
 * This is additive — it does NOT wipe existing data.
 * Requires at least one organization with a board to exist.
 */
async function main() {
  console.log('Seeding external board member...\n');

  const PHONE = '+79160000001';
  const NICKNAME = 'ext_board_member';

  // Clean up existing data if re-running
  const existing = await prisma.user.findUnique({
    where: { phoneNumber: PHONE },
  });

  if (existing) {
    await prisma.boardUser.deleteMany({ where: { userId: existing.id } });
    await prisma.organizationUser.deleteMany({
      where: { userId: existing.id },
    });
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
    console.log('Deleted existing external board member');
  }

  const pw = await hash('password123', ARGON2_OPTIONS);

  // Create the external user
  const user = await prisma.user.create({
    data: {
      firstName: 'Внешний',
      lastName: 'Участник',
      middleName: 'Борисович',
      phoneNumber: PHONE,
      password: pw,
      language: 'ru',
      consentGivenAt: new Date(),
      nickname: NICKNAME,
    },
  });
  console.log(
    `Created user: ${user.firstName} ${user.lastName} (${user.phoneNumber})`
  );

  // Find up to 3 boards from different organizations
  const boards = await prisma.board.findMany({
    where: { archivedAt: null },
    include: { organization: true },
    take: 20,
  });

  if (boards.length === 0) {
    console.error(
      'No boards found. Run the main seeder first: npx tsx prisma/seed.ts'
    );

    return;
  }

  // Pick boards from distinct organizations (up to 3)
  const seenOrgIds = new Set<string>();
  const selectedBoards = boards
    .filter((b) => {
      if (seenOrgIds.has(b.organizationId)) {
        return false;
      }

      seenOrgIds.add(b.organizationId);

      return true;
    })
    .slice(0, 3);

  // Add user to these boards WITHOUT adding to orgs
  for (const board of selectedBoards) {
    await prisma.boardUser.create({
      data: {
        boardId: board.id,
        userId: user.id,
        addedBy: null,
      },
    });
    console.log(
      `Added to board "${board.name}" (org: "${board.organization.name}")`
    );
  }

  // Verify: user should have 0 org memberships
  const orgCount = await prisma.organizationUser.count({
    where: { userId: user.id },
  });
  console.log(`\nOrg memberships: ${orgCount} (expected 0)`);
  console.log(`Board memberships: ${selectedBoards.length}`);

  console.log('\n=== External board member seeded ===');
  console.log(`Phone: ${user.phoneNumber}`);
  console.log('Password: password123');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
