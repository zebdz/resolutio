/** PostgreSQL leases use the database clock and an atomic conditional upsert.
 * Claim rows survive release so fencing tokens never reset between owners. */
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import {
  SealWorkRepository,
  SealWorkClaim,
  SealWorkOwner,
  SealLeaseSeconds,
  SealWorkFailure,
} from '@/application/seal/SealWorkRepository';
import { PollId, FencingToken, UtcTimestamp } from '@/domain/seal/SealValues';
import { Result, failure, success } from '@/domain/shared/Result';
import { z } from 'zod';

const storedClaim = z.object({
  poll_id: PollId.schema,
  owner: SealWorkOwner,
  fencing_token: FencingToken.schema,
  lease_until: z
    .date()
    .transform((d) => d.toISOString())
    .pipe(UtcTimestamp.schema),
});
export class PrismaSealWorkRepository implements SealWorkRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async acquire(
    pollId: PollId,
    owner: SealWorkOwner,
    duration: SealLeaseSeconds
  ): ReturnType<SealWorkRepository['acquire']> {
    let rows: unknown;

    try {
      rows = await this.prisma.$queryRaw`
        INSERT INTO seal_work_claims (poll_id, owner, lease_until, fencing_token)
        VALUES (${pollId}, ${owner}, clock_timestamp() + make_interval(secs => ${duration}::double precision), 1)
        ON CONFLICT (poll_id) DO UPDATE SET
          owner = EXCLUDED.owner,
          lease_until = clock_timestamp() + make_interval(secs => ${duration}::double precision),
          fencing_token = seal_work_claims.fencing_token + 1
        WHERE seal_work_claims.lease_until <= clock_timestamp()
        RETURNING poll_id, owner, lease_until, fencing_token
      `;
    } catch {
      return failure('common.errors.unexpected');
    }

    const decoded = storedClaim.array().max(1).safeParse(rows);

    if (!decoded.success) {
      return failure('common.errors.unexpected');
    }

    const row = decoded.data[0];

    return success(
      row
        ? {
            pollId: row.poll_id,
            owner: row.owner,
            token: row.fencing_token,
            leaseUntil: row.lease_until,
          }
        : null
    );
  }
  async release(
    claim: SealWorkClaim
  ): ReturnType<SealWorkRepository['release']> {
    try {
      const count = await this.prisma.$executeRaw`
        UPDATE seal_work_claims SET lease_until = clock_timestamp()
        WHERE poll_id = ${claim.pollId} AND owner = ${claim.owner}
          AND fencing_token = ${claim.token} AND lease_until > clock_timestamp()
      `;

      return success(count === 1);
    } catch {
      return failure('common.errors.unexpected');
    }
  }
}

/** Call inside the same transaction as the resulting seal/anchor write.
 * Holding this row lock prevents takeover until the validated write commits. */
export async function lockSealWorkClaim(
  tx: Prisma.TransactionClient,
  claim: SealWorkClaim
): Promise<Result<void, SealWorkFailure>> {
  // Projection expressions may run before PostgreSQL waits for a row lock.
  // Acquire first, then check the database clock while takeover is excluded.
  await tx.$queryRaw`SELECT poll_id FROM seal_work_claims WHERE poll_id = ${claim.pollId} FOR UPDATE`;
  const rows = await tx.$queryRaw<{ valid: boolean }[]>`
    SELECT owner = ${claim.owner} AND fencing_token = ${claim.token}
      AND lease_until > clock_timestamp() AS valid
    FROM seal_work_claims WHERE poll_id = ${claim.pollId}
  `;

  return rows.length === 1 && rows[0].valid
    ? success(undefined)
    : failure('seal.errors.claimLost');
}
