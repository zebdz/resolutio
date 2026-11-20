/** Connects current viewer policy and validated immutable records to the final
 * results reader used by private HTTP handlers and PDF exports. */
import { GetSealedProtocolUseCase } from '@/application/seal/GetSealedProtocolUseCase';
import { prisma } from '@/infrastructure/database/prisma';
import { PrismaSealPermissions } from '@/infrastructure/repositories/PrismaSealPermissions';
import { PrismaSealReader } from '@/infrastructure/repositories/PrismaSealReader';

export const getSealedProtocol = new GetSealedProtocolUseCase(
  new PrismaSealPermissions(prisma),
  new PrismaSealReader(prisma)
);
