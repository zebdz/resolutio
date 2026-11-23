/** Operator-run rollout step, after migrating with all vote/finish writers paused.
 * Logs counts only. Existing finished polls and all original receipt data stay untouched. */
import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { backfillReceiptSecrets } from '../src/infrastructure/repositories/ReceiptSecretBackfill';
import { CryptoReceiptSecretGenerator } from '../src/infrastructure/repositories/CryptoReceiptSecretGenerator';

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is required');
  }

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

  try {
    const generator = new CryptoReceiptSecretGenerator();
    const count = await backfillReceiptSecrets(prisma, () =>
      generator.generate()
    );
    console.log(`Receipt secrets assigned: ${count}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(() => {
  console.error(
    'Receipt-secret backfill failed; inspect the database and rerun.'
  );
  process.exitCode = 1;
});
