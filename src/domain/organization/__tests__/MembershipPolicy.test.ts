/** Membership clients receive explicit transitions instead of unrelated optional fields.
 * Policies preserve request conflicts and renewal semantics without performing I/O. */
import { expect, it } from 'vitest';
import { Instant } from '../../shared/Instant';
import { JoinTokenId, UserId, OrganizationId } from '../../shared/EntityIds';
import {
  requestMembership,
  decideMembershipRequest,
  MembershipRejectionReason,
  requirePendingMembership,
  acceptInvitedMembership,
  membershipsToLeave,
} from '../MembershipPolicy';

const now = Instant.parse('2026-10-30T12:00:00.000Z');

it('creates or renews a request while refusing accepted and pending memberships', () => {
  const joinTokenId = JoinTokenId.parse('link');
  expect(requestMembership(null, joinTokenId, now)).toEqual({
    success: true,
    value: { kind: 'new', status: 'pending', requestedAt: now, joinTokenId },
  });
  expect(requestMembership('rejected', joinTokenId, now)).toEqual({
    success: true,
    value: { kind: 'renewed', status: 'pending', joinTokenId, rejection: null },
  });
  expect(requestMembership('accepted', null, now)).toEqual({
    success: false,
    error: 'organization.errors.alreadyMember',
  });
  expect(requestMembership('pending', null, now)).toEqual({
    success: false,
    error: 'organization.errors.pendingRequest',
  });
});

it('selects only existing memberships in the same tree, excluding the organization being joined', () => {
  const joining = OrganizationId.parse('joining');
  const tree = OrganizationId.array().parse(['joining', 'parent', 'sibling']);
  const existing = OrganizationId.array().parse([
    'sibling',
    'unrelated',
    'joining',
  ]);
  expect(membershipsToLeave(joining, tree, existing)).toEqual(['sibling']);
  expect(existing).toEqual(['sibling', 'unrelated', 'joining']);
});

it('handles only pending requests and requires complete decision metadata', () => {
  const actor = UserId.parse('admin');
  expect(
    decideMembershipRequest('pending', { action: 'accept' }, actor, now)
  ).toEqual({
    success: true,
    value: { status: 'accepted', acceptedByUserId: actor, acceptedAt: now },
  });
  const reason = MembershipRejectionReason.parse('Please provide documents');
  expect(
    decideMembershipRequest('pending', { action: 'reject', reason }, actor, now)
  ).toEqual({
    success: true,
    value: {
      status: 'rejected',
      rejectedByUserId: actor,
      rejectedAt: now,
      rejectionReason: reason,
    },
  });
  expect(requirePendingMembership(null)).toEqual({
    success: false,
    error: 'organization.errors.requestNotFound',
  });
  expect(
    decideMembershipRequest(
      'accepted',
      { action: 'reject', reason: null },
      actor,
      now
    )
  ).toEqual({ success: false, error: 'organization.errors.notPending' });
  expect(acceptInvitedMembership(actor, now)).toEqual({
    status: 'accepted',
    acceptedByUserId: actor,
    acceptedAt: now,
  });
});
