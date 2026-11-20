/** PostgreSQL leases use the database clock and an atomic conditional upsert.
 * Claim rows survive release so fencing tokens never reset between owners. */
import { PrismaClient, Prisma } from '@/generated/prisma/client';
import {
  SealWorkRepository,
  SealRecoveryReader,
  recoveryItem,
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
export class PrismaSealWorkRepository
  implements SealWorkRepository, SealRecoveryReader
{
  constructor(private readonly prisma: PrismaClient) {}
  async acquire(
    pollId: PollId,
    owner: SealWorkOwner,
    duration: SealLeaseSeconds,
    source?: 'lazy'
  ): ReturnType<SealWorkRepository['acquire']> {
    let rows: unknown;

    try {
      rows = await this.prisma.$queryRaw`
        INSERT INTO seal_work_claims (poll_id, owner, lease_until, fencing_token,last_nudged_at)
        VALUES (${pollId}, ${owner}, clock_timestamp() + make_interval(secs => ${duration}::double precision), 1, CASE WHEN ${source === 'lazy'} THEN clock_timestamp() END)
        ON CONFLICT (poll_id) DO UPDATE SET
          owner = EXCLUDED.owner,
          lease_until = clock_timestamp() + make_interval(secs => ${duration}::double precision),
          last_nudged_at = COALESCE(EXCLUDED.last_nudged_at,seal_work_claims.last_nudged_at),
          fencing_token = seal_work_claims.fencing_token + 1
        WHERE seal_work_claims.lease_until <= clock_timestamp() AND
          (EXCLUDED.last_nudged_at IS NULL OR seal_work_claims.last_nudged_at IS NULL OR
           seal_work_claims.last_nudged_at <= clock_timestamp() - interval '10 minutes')
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
  async discover(
    limit: number,
    pollId?: PollId
  ): ReturnType<SealRecoveryReader['discover']> {
    // Released or expired attempts rotate behind untouched work, even if sealing failed.
    try {
      const rows = await this.prisma.$queryRaw`
        SELECT p.id AS "pollId", CASE WHEN s.poll_id IS NULL THEN 'seal' ELSE 'anchor' END AS kind
        FROM polls p LEFT JOIN poll_seals s ON s.poll_id=p.id
        LEFT JOIN seal_anchors a ON a.poll_id=s.poll_id AND a.status <> 'SUPERSEDED'
        LEFT JOIN seal_work_claims c ON c.poll_id=p.id
        WHERE p.state='FINISHED' AND p.finished_at IS NOT NULL
        AND (${pollId ?? null}::text IS NULL OR p.id=${pollId ?? null})
        AND (c.lease_until IS NULL OR c.lease_until <= CURRENT_TIMESTAMP)
        AND (a.id IS NULL OR a.next_attempt_at <= CURRENT_TIMESTAMP)
        ORDER BY c.lease_until NULLS FIRST,p.finished_at,p.id LIMIT ${limit}
      `;
      const result = recoveryItem.array().safeParse(rows);

      return result.success
        ? success(result.data)
        : failure('common.errors.unexpected');
    } catch {
      return failure('common.errors.unexpected');
    }
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
