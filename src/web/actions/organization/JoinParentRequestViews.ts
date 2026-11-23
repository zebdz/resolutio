/** Parent-request transport contracts preserve validated values and decision alternatives.
 * Date projections and the existing missing-organization label keep their wire representation. */
import type { JoinParentRequest } from '@/domain/organization/JoinParentRequest';
import type { JoinParentRejectionReason } from '@/domain/organization/JoinParentRequestValues';
import type { OrganizationName } from '@/domain/organization/OrganizationValues';
import type { User } from '@/domain/user/User';
import { Instant } from '@/domain/shared/Instant';

type OrganizationLabel = OrganizationName | 'Unknown';
export type RequestAdminView = Pick<
  User,
  'firstName' | 'lastName' | 'middleName'
>;
export type ChildParentRequestView = Pick<
  JoinParentRequest,
  'id' | 'parentOrgId' | 'message' | 'createdAt'
> & { parentOrgName: OrganizationLabel };
export type IncomingParentRequestView = Pick<
  JoinParentRequest,
  'id' | 'childOrgId' | 'message' | 'createdAt'
> & {
  childOrgName: OrganizationLabel;
  requestingAdmin: RequestAdminView | null;
};
type RequestNames = {
  childOrgName: OrganizationLabel;
  parentOrgName: OrganizationLabel;
  requestingAdmin: RequestAdminView | null;
  handlingAdmin: RequestAdminView | null;
};
type RequestDecisionView =
  | {
      status: 'pending';
      handlingAdmin: null;
      rejectionReason: null;
      handledAt: null;
    }
  | {
      status: 'accepted';
      handlingAdmin: RequestAdminView | null;
      rejectionReason: null;
      handledAt: Date;
    }
  | {
      status: 'rejected';
      handlingAdmin: RequestAdminView | null;
      rejectionReason: JoinParentRejectionReason;
      handledAt: Date;
    };
export type EnrichedJoinParentRequest = Pick<
  JoinParentRequest,
  'id' | 'childOrgId' | 'parentOrgId' | 'message' | 'createdAt'
> &
  Omit<RequestNames, 'handlingAdmin'> &
  RequestDecisionView;

function profileFields(
  profile: RequestAdminView | null
): RequestAdminView | null {
  if (profile === null) {
    return null;
  }

  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    middleName: profile.middleName,
  };
}

export function serializeJoinParentRequest(
  request: JoinParentRequest,
  names: RequestNames
): EnrichedJoinParentRequest {
  const common = {
    id: request.id,
    childOrgId: request.childOrgId,
    parentOrgId: request.parentOrgId,
    childOrgName: names.childOrgName,
    parentOrgName: names.parentOrgName,
    requestingAdmin: profileFields(names.requestingAdmin),
    message: request.message,
    createdAt: request.createdAt,
  };
  const decision = request.decision;

  switch (decision.status) {
    case 'pending':
      return {
        ...common,
        status: decision.status,
        handlingAdmin: null,
        rejectionReason: null,
        handledAt: null,
      };
    case 'accepted':
      return {
        ...common,
        status: decision.status,
        handlingAdmin: profileFields(names.handlingAdmin),
        rejectionReason: null,
        handledAt: Instant.toDate(decision.handledAt),
      };
    case 'rejected':
      return {
        ...common,
        status: decision.status,
        handlingAdmin: profileFields(names.handlingAdmin),
        rejectionReason: decision.rejectionReason,
        handledAt: Instant.toDate(decision.handledAt),
      };
  }
}
