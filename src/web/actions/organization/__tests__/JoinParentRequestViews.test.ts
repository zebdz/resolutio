/** Parent-request serialization preserves decision dates and missing-profile conventions.
 * Explicit nested mapping must exclude private fields even when full profiles are supplied. */
import { expect, it } from 'vitest';
import { JoinParentRequest } from '@/domain/organization/JoinParentRequest';
import { OrganizationName } from '@/domain/organization/OrganizationValues';
import { FirstName, LastName, MiddleName } from '@/domain/user/UserValues';
import { serializeJoinParentRequest } from '../JoinParentRequestViews';

const createdAt = new Date('2026-11-04T12:00:00.000Z');
const handledAt = new Date('2026-11-04T12:34:56.789Z');
const base = {
  id: 'request-1',
  childOrgId: 'child',
  parentOrgId: 'parent',
  requestingAdminId: 'requester',
  message: 'Join request',
  createdAt,
};
const profile = {
  firstName: FirstName.parse('Alice'),
  lastName: LastName.parse('Smith'),
  middleName: MiddleName.parse('Marie'),
  privateContact: 'secret',
};
it.each([
  {
    status: 'pending',
    handlingAdminId: null,
    handledAt: null,
    rejectionReason: null,
  },
  {
    status: 'accepted',
    handlingAdminId: 'handler',
    handledAt,
    rejectionReason: null,
  },
  {
    status: 'rejected',
    handlingAdminId: 'handler',
    handledAt,
    rejectionReason: 'Wrong organization',
  },
])(
  'serializes $status without private profile fields or domain state',
  (decision) => {
    const request = JoinParentRequest.reconstitute({ ...base, ...decision });
    const view = serializeJoinParentRequest(request, {
      childOrgName: OrganizationName.parse('Child'),
      parentOrgName: OrganizationName.parse('Parent'),
      requestingAdmin: profile,
      handlingAdmin: decision.status === 'pending' ? null : profile,
    });
    const safeProfile = {
      firstName: 'Alice',
      lastName: 'Smith',
      middleName: 'Marie',
    };

    expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
    expect(view).toEqual({
      id: 'request-1',
      childOrgId: 'child',
      childOrgName: 'Child',
      parentOrgId: 'parent',
      parentOrgName: 'Parent',
      requestingAdmin: safeProfile,
      handlingAdmin: decision.status === 'pending' ? null : safeProfile,
      message: 'Join request',
      createdAt,
      status: decision.status,
      rejectionReason: decision.rejectionReason,
      handledAt: decision.handledAt,
    });
    expect(view.createdAt).toBeInstanceOf(Date);
    expect(JSON.stringify(view)).not.toContain('secret');
    expect(JSON.stringify(view)).not.toContain('requestingAdminId');
  }
);

it('keeps the existing missing-organization label and absent handling profile for a decided request', () => {
  const request = JoinParentRequest.reconstitute({
    ...base,
    status: 'accepted',
    handlingAdminId: 'handler',
    handledAt,
    rejectionReason: null,
  });
  const view = serializeJoinParentRequest(request, {
    childOrgName: 'Unknown',
    parentOrgName: 'Unknown',
    requestingAdmin: null,
    handlingAdmin: null,
  });

  expect(view.childOrgName).toBe('Unknown');
  expect(view.parentOrgName).toBe('Unknown');
  expect(view.requestingAdmin).toBeNull();
  expect(view.handlingAdmin).toBeNull();
  expect(view.handledAt).toEqual(handledAt);
});
