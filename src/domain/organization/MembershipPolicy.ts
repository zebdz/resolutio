/** Pure membership lifecycle rules produce validated, explicit persistence transitions.
 * Membership identity is the organization/user pair; no storage surrogate ID enters this model. */
import { z } from 'zod';
import { JoinTokenId, OrganizationId, UserId } from '../shared/EntityIds';
import { Instant } from '../shared/Instant';
import { Result, success, failure } from '../shared/Result';

export const MembershipStatus = z.enum(['pending', 'accepted', 'rejected']);
export type MembershipStatus = z.infer<typeof MembershipStatus>;
export const MembershipReference = z
  .object({ organizationId: OrganizationId, userId: UserId })
  .readonly();
export type MembershipReference = z.infer<typeof MembershipReference>;

// Keep existing localized codes while moving ownership of these rules into the domain.
export const MembershipPolicyCodes = {
  ALREADY_MEMBER: 'organization.errors.alreadyMember',
  PENDING_REQUEST: 'organization.errors.pendingRequest',
  REQUEST_NOT_FOUND: 'organization.errors.requestNotFound',
  NOT_PENDING: 'organization.errors.notPending',
} as const;
export type MembershipPolicyFailure =
  (typeof MembershipPolicyCodes)[keyof typeof MembershipPolicyCodes];

export const MembershipRequestChange = z
  .discriminatedUnion('kind', [
    z.object({
      kind: z.literal('new'),
      status: z.literal('pending'),
      requestedAt: Instant.schema,
      joinTokenId: JoinTokenId.nullable(),
    }),
    z.object({
      kind: z.literal('renewed'),
      status: z.literal('pending'),
      joinTokenId: JoinTokenId.nullable(),
      rejection: z.null(),
    }),
  ])
  .readonly();
export type MembershipRequestChange = z.infer<typeof MembershipRequestChange>;

export function requestMembership(
  current: MembershipStatus | null,
  joinTokenId: JoinTokenId | null,
  now: Instant
): Result<MembershipRequestChange, MembershipPolicyFailure> {
  switch (current) {
    case 'accepted':
      return failure(MembershipPolicyCodes.ALREADY_MEMBER);
    case 'pending':
      return failure(MembershipPolicyCodes.PENDING_REQUEST);
    case 'rejected':
      return success(
        MembershipRequestChange.parse({
          kind: 'renewed',
          status: 'pending',
          joinTokenId,
          rejection: null,
        })
      );
    case null:
      return success(
        MembershipRequestChange.parse({
          kind: 'new',
          status: 'pending',
          requestedAt: now,
          joinTokenId,
        })
      );

    default: {
      const exhaustive: never = current;
      throw new Error(`Invalid membership status: ${exhaustive}`);
    }
  }
}

export const MEMBERSHIP_REJECTION_REASON_MAX_LENGTH = 500;
export const MembershipRejectionReason = z
  .string()
  .min(1)
  .max(MEMBERSHIP_REJECTION_REASON_MAX_LENGTH)
  .brand<'MembershipRejectionReason'>();
export type MembershipRejectionReason = z.infer<
  typeof MembershipRejectionReason
>;
export const MembershipAcceptance = z
  .object({
    status: z.literal('accepted'),
    acceptedByUserId: UserId,
    acceptedAt: Instant.schema,
  })
  .readonly();
export type MembershipAcceptance = z.infer<typeof MembershipAcceptance>;
export const MembershipDecision = z.union([
  MembershipAcceptance,
  z
    .object({
      status: z.literal('rejected'),
      rejectedByUserId: UserId,
      rejectedAt: Instant.schema,
      rejectionReason: MembershipRejectionReason.nullable(),
    })
    .readonly(),
]);
export type MembershipDecision = z.infer<typeof MembershipDecision>;
export type MembershipAction =
  | { readonly action: 'accept' }
  | {
      readonly action: 'reject';
      readonly reason: MembershipRejectionReason | null;
    };

export function requirePendingMembership(
  current: MembershipStatus | null
): Result<void, MembershipPolicyFailure> {
  if (current === null) {
    return failure(MembershipPolicyCodes.REQUEST_NOT_FOUND);
  }

  if (current !== 'pending') {
    return failure(MembershipPolicyCodes.NOT_PENDING);
  }

  return success(undefined);
}

export function acceptInvitedMembership(
  actor: UserId,
  now: Instant
): MembershipAcceptance {
  return MembershipAcceptance.parse({
    status: 'accepted',
    acceptedByUserId: actor,
    acceptedAt: now,
  });
}

export function decideMembershipRequest(
  current: MembershipStatus | null,
  action: MembershipAction,
  actor: UserId,
  now: Instant
): Result<MembershipDecision, MembershipPolicyFailure> {
  const pending = requirePendingMembership(current);

  if (!pending.success) {
    return pending;
  }

  switch (action.action) {
    case 'accept':
      return success(acceptInvitedMembership(actor, now));
    case 'reject':
      return success(
        MembershipDecision.parse({
          status: 'rejected',
          rejectedByUserId: actor,
          rejectedAt: now,
          rejectionReason: action.reason,
        })
      );

    default: {
      const exhaustive: never = action;
      throw new Error(`Invalid membership decision: ${exhaustive}`);
    }
  }
}

/** Select prior memberships to relinquish when a tree permits only one membership. */
export function membershipsToLeave(
  joining: OrganizationId,
  tree: readonly OrganizationId[],
  existing: readonly OrganizationId[]
): OrganizationId[] {
  return existing.filter((id) => id !== joining && tree.includes(id));
}
