/** Parent-request text values and decision variants encode the metadata required
 * by pending, accepted and rejected requests without optional-field combinations. */
import { z } from 'zod';
import { UserId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { Result, success, failure } from '../shared/Result';
import {
  JoinParentRequestDomainCode,
  JoinParentRequestDomainCodes as Codes,
} from './JoinParentRequestDomainCodes';
export const JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH = 500;
export const REJECTION_REASON_MAX_LENGTH = 500;
export const JoinParentRequestMessage = z
  .string()
  .max(JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH)
  .trim()
  .min(1)
  .brand<'JoinParentRequestMessage'>();
export type JoinParentRequestMessage = z.infer<typeof JoinParentRequestMessage>;
export const JoinParentRejectionReason = z
  .string()
  .max(REJECTION_REASON_MAX_LENGTH)
  .trim()
  .min(1)
  .brand<'JoinParentRejectionReason'>();
export type JoinParentRejectionReason = z.infer<
  typeof JoinParentRejectionReason
>;
export const JoinParentDecision = z
  .discriminatedUnion('status', [
    z.object({
      status: z.literal('pending'),
      handlingAdminId: z.null(),
      handledAt: z.null(),
      rejectionReason: z.null(),
    }),
    z.object({
      status: z.literal('accepted'),
      handlingAdminId: UserId,
      handledAt: Instant.schema,
      rejectionReason: z.null(),
    }),
    z.object({
      status: z.literal('rejected'),
      handlingAdminId: UserId,
      handledAt: Instant.schema,
      rejectionReason: JoinParentRejectionReason,
    }),
  ])
  .readonly();
export type JoinParentDecision = z.infer<typeof JoinParentDecision>;

export function parseJoinParentMessage(
  raw: unknown
): Result<JoinParentRequestMessage, JoinParentRequestDomainCode> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return failure(Codes.MESSAGE_EMPTY);
  }

  if (raw.length > JOIN_PARENT_REQUEST_MESSAGE_MAX_LENGTH) {
    return failure(Codes.MESSAGE_TOO_LONG);
  }

  return success(JoinParentRequestMessage.parse(raw));
}

export function parseJoinParentRejectionReason(
  raw: unknown
): Result<JoinParentRejectionReason, JoinParentRequestDomainCode> {
  if (typeof raw !== 'string' || !raw.trim()) {
    return failure(Codes.REJECTION_REASON_REQUIRED);
  }

  if (raw.length > REJECTION_REASON_MAX_LENGTH) {
    return failure(Codes.REJECTION_REASON_TOO_LONG);
  }

  return success(JoinParentRejectionReason.parse(raw));
}
