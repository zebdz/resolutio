/** Compile-only parent-request clients cannot omit decision metadata or substitute
 * actor/request identities, message/reason text, or mutable Date timestamps. */
import { JoinParentRequest } from '../JoinParentRequest';
import { JoinParentRequestRepository } from '../JoinParentRequestRepository';
import {
  JoinParentDecision,
  JoinParentRequestMessage,
  JoinParentRejectionReason,
} from '../JoinParentRequestValues';
import {
  OrganizationId,
  UserId,
  JoinParentRequestId,
} from '../../shared/EntityIds';
import { Instant } from '../../shared/Instant';
declare const request: JoinParentRequest;
declare const repository: JoinParentRequestRepository;
const actor = UserId.parse('actor');
const now = Instant.parse('2026-01-01T00:00:00.000Z');
const props = {
  childOrgId: OrganizationId.parse('child'),
  parentOrgId: OrganizationId.parse('parent'),
  requestingAdminId: actor,
  message: JoinParentRequestMessage.parse('Please join'),
};
JoinParentRequest.create(props, {
  id: JoinParentRequestId.parse('request'),
  now,
});
request.reject(actor, JoinParentRejectionReason.parse('Incompatible'), now);
// @ts-expect-error Requests require caller-provided identity and time.
JoinParentRequest.create(props);
// @ts-expect-error An acceptance requires its handling actor and time.
const incomplete: JoinParentDecision = {
  status: 'accepted',
  rejectionReason: null,
};
// @ts-expect-error A pending decision cannot have a handling actor.
const handledPending: JoinParentDecision = {
  status: 'pending',
  handlingAdminId: actor,
  handledAt: null,
  rejectionReason: null,
};
// @ts-expect-error Decision actor cannot be a request identity.
request.accept(JoinParentRequestId.parse('request'), now);
// @ts-expect-error Decision time cannot be a mutable Date.
request.accept(actor, new Date());
// @ts-expect-error Request text is not a validated rejection reason.
request.reject(actor, JoinParentRequestMessage.parse('Message'), now);
// @ts-expect-error Unchecked text cannot become a rejection reason.
request.reject(actor, 'Reason', now);
// @ts-expect-error Repository lookups require request identity.
repository.findById(actor);
void incomplete;
void handledPending;
