/** Parent-request clients retain validated references, messages and decision alternatives.
 * Compile failures guard against action annotations erasing domain constraints. */
import { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { LastName } from '@/domain/user/UserValues';
import {
  getChildOrgJoinParentRequestAction,
  getIncomingJoinParentRequestsAction,
  getAllJoinParentRequestsAction,
} from '../joinParentRequest';
type Data<T> =
  Extract<Awaited<T>, { success: true }> extends { data: infer D } ? D : never;
type Child = NonNullable<
  Data<ReturnType<typeof getChildOrgJoinParentRequestAction>>['request']
>;
type Incoming = Data<
  ReturnType<typeof getIncomingJoinParentRequestsAction>
>['requests'][number];
type All = Data<
  ReturnType<typeof getAllJoinParentRequestsAction>
>['outgoing'][number];
// @ts-expect-error Request identities are distinct from organization identities.
const organizationAsRequest: Child['id'] = OrganizationId.parse('org');
// @ts-expect-error Parent references cannot contain user identities.
const userAsParent: Child['parentOrgId'] = UserId.parse('user');
// @ts-expect-error Request messages must be validated.
const uncheckedMessage: Incoming['message'] = '';
// @ts-expect-error Profile first and last names remain distinct.
const lastAsFirst: NonNullable<Incoming['requestingAdmin']>['firstName'] =
  LastName.parse('Smith');
// @ts-expect-error Combined list identities also remain request identities.
const userAsRequest: All['id'] = UserId.parse('user');
declare const request: All;
const handledPending = {
  ...request,
  status: 'pending' as const,
  handledAt: new Date(),
  rejectionReason: null,
  handlingAdmin: null,
};
// @ts-expect-error Pending requests cannot have a handling time.
const invalidPending: All = handledPending;
const unhandledAccepted = {
  ...request,
  status: 'accepted' as const,
  handledAt: null,
  rejectionReason: null,
};
// @ts-expect-error Accepted requests require their handling time.
const invalidAccepted: All = unhandledAccepted;
const reasonlessRejected = {
  ...request,
  status: 'rejected' as const,
  handledAt: new Date(),
  rejectionReason: null,
};
// @ts-expect-error Rejected requests require their rejection reason.
const invalidRejected: All = reasonlessRejected;
