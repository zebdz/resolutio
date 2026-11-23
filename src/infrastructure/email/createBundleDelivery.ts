/** Wire first-bundle recovery to the same authorized voter projection as downloads. */
import { PrismaClient } from '@/generated/prisma/client';
import { SealExports } from '@/application/seal/SealExports';
import { BundleDelivery } from '@/application/seal/BundleDelivery';
import { PrismaSealReader } from '../repositories/PrismaSealReader';
import { PrismaSealPermissions } from '../repositories/PrismaSealPermissions';
import { PrismaBundleDelivery } from '../repositories/PrismaBundleDelivery';
import { createEvidenceMail } from './createEvidenceMail';
import { createEmailSenderFromEnv } from './emailSenderFactory';

export function createBundleDelivery(
  prisma: PrismaClient,
  sender = createEmailSenderFromEnv()
) {
  const exports = new SealExports(
    new PrismaSealReader(prisma),
    new PrismaSealPermissions(prisma)
  );

  return new BundleDelivery(
    new PrismaBundleDelivery(prisma),
    createEvidenceMail(prisma, sender),
    exports
  );
}
