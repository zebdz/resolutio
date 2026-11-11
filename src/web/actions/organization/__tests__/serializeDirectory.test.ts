/** Directory serialization exposes only the existing browser fields and converts
 * domain nicknames/instants before crossing the Server/Client boundary. */
import { expect, it } from 'vitest';
import { OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { Organization } from '@/domain/organization/Organization';
import { OrganizationName } from '@/domain/organization/OrganizationValues';
import { Instant } from '@/domain/shared/Instant';
import { FirstName, LastName, MiddleName } from '@/domain/user/UserValues';
import { Nickname } from '@/domain/user/Nickname';
import { serializeTreeMember } from '../serializeProperty';
import {
  serializeDirectoryAdmin,
  serializeUserOrganizations,
  serializeDirectoryMember,
  serializeOrganizationPendingRequest,
  serializeAdminPendingRequest,
} from '../serializeDirectory';

it.each([
  { middleName: null, label: 'Smith Alice (@alice_smith)' },
  {
    middleName: MiddleName.parse('Marie'),
    label: 'Smith Alice Marie (@alice_smith)',
  },
])(
  'serializes the tree member label $label with only permitted fields',
  ({ middleName, label }) => {
    const view = serializeTreeMember({
      id: UserId.parse('user'),
      firstName: FirstName.parse('Alice'),
      lastName: LastName.parse('Smith'),
      middleName,
      nickname: Nickname.create('alice_smith'),
      orgNames: [
        OrganizationName.parse('Parent'),
        OrganizationName.parse('Child'),
      ],
    });

    expect(Object.getPrototypeOf(view)).toBe(Object.prototype);
    expect(JSON.parse(JSON.stringify(view))).toEqual({
      id: 'user',
      label,
      orgNames: ['Parent', 'Child'],
    });
  }
);

it('serializes both membership projections without exposing domain objects', () => {
  const person = {
    id: UserId.parse('user'),
    firstName: FirstName.parse('Alice'),
    lastName: LastName.parse('Smith'),
    middleName: null,
    nickname: Nickname.create('alice_smith'),
  };
  const now = Instant.parse('2026-10-30T12:00:00.000Z');
  const admin = serializeDirectoryAdmin({ ...person, createdAt: now });
  expect(admin).toEqual({
    id: 'user',
    firstName: 'Alice',
    lastName: 'Smith',
    middleName: null,
    nickname: 'alice_smith',
    createdAt: new Date(now),
  });
  expect(serializeDirectoryMember({ ...person, joinedAt: null })).toEqual({
    id: 'user',
    firstName: 'Alice',
    lastName: 'Smith',
    middleName: null,
    nickname: 'alice_smith',
    joinedAt: null,
  });
  expect(
    serializeDirectoryMember({ ...person, joinedAt: now }).joinedAt
  ).toEqual(new Date(now));
});

it('preserves the two existing pending-request payloads and their missing-name conventions', () => {
  const requestedAt = Instant.parse('2026-10-30T12:00:00.000Z');
  const requester = {
    id: UserId.parse('user'),
    firstName: FirstName.parse('Alice'),
    lastName: LastName.parse('Smith'),
    middleName: null,
  };
  expect(
    serializeAdminPendingRequest({
      organizationId: OrganizationId.parse('org'),
      organizationName: OrganizationName.parse('Organization'),
      requester,
      requestedAt,
    })
  ).toEqual({
    organizationId: 'org',
    organizationName: 'Organization',
    requester: {
      id: 'user',
      firstName: 'Alice',
      lastName: 'Smith',
      middleName: null,
    },
    requestedAt: new Date(requestedAt),
  });
  expect(
    serializeOrganizationPendingRequest({
      userId: requester.id,
      firstName: requester.firstName,
      lastName: requester.lastName,
      middleName: null,
      requestedAt,
    })
  ).toEqual({
    userId: 'user',
    firstName: 'Alice',
    lastName: 'Smith',
    middleName: undefined,
    requestedAt: new Date(requestedAt),
  });
});

it('serializes membership organizations, parent references and decision actors explicitly', () => {
  const now = Instant.parse('2026-10-30T12:00:00.000Z');
  const organization = Organization.reconstitute({
    id: 'org',
    name: 'Organization',
    description: 'Description',
    parentId: 'parent',
    createdById: 'creator',
    createdAt: new Date(now),
    archivedAt: null,
    allowMultiTreeMembership: null,
  });
  const common = {
    organization,
    parentOrg: {
      id: OrganizationId.parse('parent'),
      name: OrganizationName.parse('Parent'),
    },
  };
  const actor = {
    id: UserId.parse('admin'),
    firstName: FirstName.parse('Alice'),
    lastName: LastName.parse('Smith'),
    middleName: null,
  };
  const dto = serializeUserOrganizations(
    {
      member: [{ ...common, joinedAt: now }],
      pending: [{ ...common, requestedAt: now }],
      rejected: [
        {
          ...common,
          rejectedAt: now,
          rejectionReason: null,
          rejectedBy: actor,
        },
      ],
    },
    new Map([[organization.id, true]])
  );
  const fields = {
    id: 'org',
    name: 'Organization',
    description: 'Description',
    parentOrg: { id: 'parent', name: 'Parent' },
  };
  expect(dto.member).toEqual([
    {
      ...fields,
      joinedAt: new Date(now),
      archivedAt: null,
      hasProperties: true,
    },
  ]);
  expect(dto.pending).toEqual([{ ...fields, requestedAt: new Date(now) }]);
  expect(dto.rejected).toEqual([
    {
      ...fields,
      rejectedAt: new Date(now),
      rejectionReason: null,
      rejectedBy: {
        id: 'admin',
        firstName: 'Alice',
        lastName: 'Smith',
        middleName: null,
      },
    },
  ]);
});
