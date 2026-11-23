/** Compile-only clients prove that membership decisions cannot omit actors/time
 * or substitute raw dates, arbitrary status strings and unrelated identities. */
import { UserId, OrganizationId } from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
import {
  MembershipAcceptance,
  MembershipAction,
  MembershipRequestChange,
  MembershipReference,
  MembershipStatus,
  acceptInvitedMembership,
} from '../MembershipPolicy';
declare const actor: UserId;
declare const at: Instant;
const accepted: MembershipAcceptance = acceptInvitedMembership(actor, at);
// @ts-expect-error Acceptance must record an actor and timestamp together.
const missingTime: MembershipAcceptance = {
  status: 'accepted',
  acceptedByUserId: actor,
};
// @ts-expect-error Rejection must explicitly account for the optional reason.
const missingReason: MembershipAction = { action: 'reject' };
// @ts-expect-error New requests must have an explicit creation instant.
const incompleteRequest: MembershipRequestChange = {
  kind: 'new',
  status: 'pending',
  joinTokenId: null,
};
// @ts-expect-error Membership status is a closed vocabulary.
const invalidStatus: MembershipStatus = 'unknown';
// @ts-expect-error Mutable Date instances are not domain instants.
acceptInvitedMembership(actor, new Date());
const wrongReference: MembershipReference = {
  organizationId: OrganizationId.parse('org'),
  // @ts-expect-error An organization reference cannot identify a member.
  userId: OrganizationId.parse('org'),
};

import {
  MemberOrganization,
  RejectedOrganization,
} from '../../../application/organization/GetUserOrganizationsUseCase';
// @ts-expect-error Membership read projections retain immutable instants.
const joinedAt: MemberOrganization['joinedAt'] = new Date();
// @ts-expect-error Rejection actors retain validated profile names.
const rejectedByName: RejectedOrganization['rejectedBy']['firstName'] =
  'unchecked';
