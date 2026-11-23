/** Wire durable poll-recovery entry points to PostgreSQL and the selected provider. */
import { createBundleDelivery } from '../email/createBundleDelivery';
import { createEmailSenderFromEnv } from '../email/emailSenderFactory';
import { PrismaClient } from '@/generated/prisma/client';
import { AnchorSealUseCase } from '@/application/seal/AnchorSealUseCase';
import { SealPollUseCase } from '@/application/seal/SealPollUseCase';
import { UpgradeAnchorsUseCase } from '@/application/seal/UpgradeAnchorsUseCase';
import { SealLeaseSeconds } from '@/application/seal/SealWorkRepository';
import {
  CryptoIdGenerator,
  SystemClock,
} from '@/infrastructure/shared/SystemEntityCreation';
import { PrismaSealWorkRepository } from '@/infrastructure/repositories/PrismaSealWorkRepository';
import { PrismaSealingTransaction } from '@/infrastructure/repositories/PrismaSealingTransaction';
import {
  createAnchorProvider,
  requiredAnchorConfig,
} from './anchorProviderFactory';

export function createSealRecovery(
  prisma: PrismaClient,
  config = requiredAnchorConfig(),
  sender = createEmailSenderFromEnv()
) {
  const provider = createAnchorProvider(config);
  // One claim can cover an upgrade followed by a separate verification deadline.
  const duration = Math.max(120, Math.ceil((2 * config.timeoutMs) / 1000) + 30);
  const work = new PrismaSealWorkRepository(prisma);
  const tx = new PrismaSealingTransaction(prisma);
  const ids = new CryptoIdGenerator();

  const deliveries = createBundleDelivery(prisma, sender);

  return new UpgradeAnchorsUseCase(
    work,
    new SealPollUseCase(work, tx),
    new AnchorSealUseCase(work, tx, provider, ids, new SystemClock()),
    ids,
    SealLeaseSeconds.parse(duration),
    (limit, pollId) => deliveries.recover(limit, pollId)
  );
}
