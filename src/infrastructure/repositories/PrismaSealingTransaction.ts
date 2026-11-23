/** Repeatable-read sealing transaction; explicit callback failures abort Prisma's
 * transaction before becoming Results again. No provider/network work belongs here. */
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import {
  SealingTransaction,
  SealingScope,
} from '@/application/seal/SealingTransaction';
import { SealWorkClaim } from '@/application/seal/SealWorkRepository';
import { SealPersistenceFailureCode as Failure } from '@/domain/seal/SealPersistenceFailureCode';
import { UtcTimestamp } from '@/domain/seal/SealValues';
import { Result, failure } from '@/domain/shared/Result';
import { PrismaPollRecordSnapshotReader } from './PrismaPollRecordSnapshotReader';
import { PrismaPollSealRepository } from './PrismaPollSealRepository';
import { lockSealWorkClaim } from './PrismaSealWorkRepository';

class Rollback extends Error {
  constructor(readonly result: { success: false; error: unknown }) {
    super('Sealing transaction aborted');
  }
}
export class PrismaSealingTransaction implements SealingTransaction {
  constructor(private readonly prisma: PrismaClient) {}
  async run<T, E>(
    claim: SealWorkClaim,
    work: (scope: SealingScope) => Promise<Result<T, E>>
  ): Promise<Result<T, E | Failure>> {
    // Only serialization/uniqueness conflicts replay this DB-only callback.
    for (let attempt = 0; attempt < 3; attempt++) {
      let rejected: Result<T, E | Failure> | undefined;

      try {
        return await this.prisma.$transaction(
          async (tx) => {
            const locked = await lockSealWorkClaim(tx, claim);

            if (!locked.success) {
              return failure(Failure.parse(locked.error));
            }

            // Return a UTC timestamp without an offset: the pg adapter otherwise
            // relabels the session's local timestamptz clock reading as UTC.
            const [clock] = await tx.$queryRaw<
              { at: Date }[]
            >`SELECT clock_timestamp() AT TIME ZONE 'UTC' AS at`;
            const result = await work({
              snapshot: new PrismaPollRecordSnapshotReader(tx),
              seals: new PrismaPollSealRepository(tx, claim),
              capturedAt: UtcTimestamp.fromDate(clock.at),
            });

            if (!result.success) {
              rejected = result;
              // Prisma commits resolved callbacks, including failed Results.
              throw new Rollback(result);
            }

            return result;
          },
          { isolationLevel: 'RepeatableRead' }
        );
      } catch (error) {
        if (error instanceof Rollback && rejected) {
          return rejected;
        }

        if (
          error instanceof Prisma.PrismaClientKnownRequestError &&
          ['P2034', 'P2002'].includes(error.code)
        ) {
          continue;
        }

        return failure(Failure.parse('common.errors.unexpected'));
      }
    }

    return failure(Failure.parse('common.errors.unexpected'));
  }
}
