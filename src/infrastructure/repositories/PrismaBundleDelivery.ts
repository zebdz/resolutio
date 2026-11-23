/** PostgreSQL recovery queue for the first proof email. Claims recheck the current
 * confirmed address. A terminal or expired handoff never becomes pending again. */
import { PrismaClient } from '@/generated/prisma/client';
import {
  BundleDeliveryStore,
  DeliveryKey,
  DeliveryOutcome,
} from '@/application/seal/BundleDelivery';
import { Recipient } from '@/application/seal/EvidenceMail';
import { PollId } from '@/domain/seal/SealValues';
import { success, failure } from '@/domain/shared/Result';

// Next dev can load the client and query from separate Prisma runtimes.
// Interpolate the scalar duration so PostgreSQL always receives a native interval.
const handoffMinutes = 10;
export class PrismaBundleDelivery implements BundleDeliveryStore {
  constructor(private readonly db: PrismaClient) {}
  async discover(
    limit: number,
    pollId?: PollId
  ): ReturnType<BundleDeliveryStore['discover']> {
    try {
      const rows = await this.db.$transaction(async (tx) => {
        await tx.$executeRaw`
          WITH expired AS (
            SELECT poll_id, user_id FROM seal_bundle_deliveries
            WHERE status = 'SENDING' AND attempt_started_at <= clock_timestamp() - make_interval(mins => ${handoffMinutes}::int)
              AND (${pollId ?? null}::text IS NULL OR poll_id = ${pollId ?? null})
            ORDER BY attempt_started_at, poll_id, user_id LIMIT ${limit} FOR UPDATE SKIP LOCKED
          )
          UPDATE seal_bundle_deliveries d
          SET status = 'UNKNOWN', completed_at = clock_timestamp(), last_error = 'attemptExpired'
          FROM expired e WHERE (d.poll_id, d.user_id) = (e.poll_id, e.user_id)`;

        await tx.$executeRaw`
          INSERT INTO seal_bundle_deliveries (poll_id, user_id)
          SELECT s.poll_id, v.id FROM poll_seals s
          JOIN seal_anchors a ON a.poll_id = s.poll_id AND a.status <> 'SUPERSEDED' AND a.pending_proof IS NOT NULL
          CROSS JOIN LATERAL (
            SELECT DISTINCT leaf->'preimage'->>'userId' AS id FROM jsonb_array_elements(s.votes) leaf
          ) v
          JOIN users u ON u.id = v.id AND u.email_confirmed_at IS NOT NULL AND u.email IS NOT NULL
          WHERE (${pollId ?? null}::text IS NULL OR s.poll_id = ${pollId ?? null})
            AND NOT EXISTS (
              SELECT 1 FROM seal_bundle_deliveries d WHERE d.poll_id = s.poll_id AND d.user_id = v.id
            )
          ORDER BY s.poll_id, v.id LIMIT ${limit} ON CONFLICT DO NOTHING`;

        // Rotate preparation independently of the one-time SMTP claim.
        return tx.$queryRaw`
          WITH ready AS (
            SELECT d.poll_id, d.user_id FROM seal_bundle_deliveries d
            JOIN users u ON u.id = d.user_id AND u.email IS NOT NULL AND u.email_confirmed_at IS NOT NULL
            JOIN seal_anchors a ON a.poll_id = d.poll_id AND a.status <> 'SUPERSEDED' AND a.pending_proof IS NOT NULL
            WHERE d.status = 'PENDING' AND (${pollId ?? null}::text IS NULL OR d.poll_id = ${pollId ?? null})
            ORDER BY d.last_selected_at NULLS FIRST, d.created_at, d.poll_id, d.user_id
            LIMIT ${limit} FOR UPDATE OF d SKIP LOCKED
          )
          UPDATE seal_bundle_deliveries d SET last_selected_at = clock_timestamp()
          FROM ready r WHERE (d.poll_id, d.user_id) = (r.poll_id, r.user_id)
          RETURNING d.poll_id AS "pollId", d.user_id AS "userId"`;
      });
      const keys = DeliveryKey.array().safeParse(rows);

      return keys.success
        ? success(keys.data)
        : failure('common.errors.unexpected');
    } catch {
      return failure('common.errors.unexpected');
    }
  }
  async claim(
    key: DeliveryKey,
    recipient: Recipient
  ): ReturnType<BundleDeliveryStore['claim']> {
    try {
      const count = await this.db.$executeRaw`
        UPDATE seal_bundle_deliveries d SET status = 'SENDING', attempt_started_at = clock_timestamp()
        FROM users u WHERE d.poll_id = ${key.pollId} AND d.user_id = ${key.userId} AND d.status = 'PENDING'
          AND u.id = d.user_id AND u.email_confirmed_at IS NOT NULL
          AND u.email = ${recipient.address.getValue()} AND u.language = ${recipient.language}`;

      return success(count === 1);
    } catch {
      return failure('common.errors.unexpected');
    }
  }
  async complete(
    key: DeliveryKey,
    outcome: DeliveryOutcome
  ): ReturnType<BundleDeliveryStore['complete']> {
    const error =
      outcome === 'SENT'
        ? null
        : outcome === 'FAILED'
          ? 'sendFailed'
          : 'outcomeUnknown';

    try {
      const count = await this.db.$executeRaw`
        UPDATE seal_bundle_deliveries SET status = ${outcome}, completed_at = clock_timestamp(), last_error = ${error}
        WHERE poll_id = ${key.pollId} AND user_id = ${key.userId}
          AND status = 'SENDING' AND attempt_started_at > clock_timestamp() - make_interval(mins => ${handoffMinutes}::int)`;

      return success(count === 1);
    } catch {
      return failure('common.errors.unexpected');
    }
  }
}
