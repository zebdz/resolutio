/** Directory reads decode only public profile projections and preserve query scope.
 * Invalid stored identities, units and timestamps must not enter the core. */
import { describe, expect, it, vi } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PageNumber, PageSize, ResultLimit } from '@/domain/shared/Pagination';
import { expectSuccess } from '@/domain/shared/__tests__/resultAssertions';
import { BoardId, OrganizationId, UserId } from '@/domain/shared/EntityIds';
import { PrismaOrganizationDirectory } from '../PrismaOrganizationDirectory';

describe('organization directory', () => {
  it('counts accepted members of the exact organization', async () => {
    const count = vi.fn().mockResolvedValue(3);
    const client = { organizationUser: { count } } as unknown as PrismaClient;
    const directory = new PrismaOrganizationDirectory(client);

    expect(
      await directory.countAcceptedMembers(OrganizationId.parse('org'))
    ).toEqual({ success: true, value: 3 });
    expect(count).toHaveBeenCalledWith({
      where: { organizationId: 'org', status: 'accepted' },
    });
  });
});

const user = {
  id: 'user',
  firstName: 'Alice',
  lastName: 'Smith',
  middleName: null,
  nickname: 'alice_smith',
  passwordHash: 'private',
};
const time = new Date('2026-10-30T12:00:00.000Z');

it('groups a user membership list using typed status-specific times and rejection actors', async () => {
  const organization = {
    id: 'org',
    name: 'Organization',
    description: 'Description',
    parentId: null,
    parent: null,
    createdById: 'creator',
    createdAt: time,
    archivedAt: null,
    allowMultiTreeMembership: false,
  };
  const findMany = vi.fn().mockResolvedValue([
    { organization, status: 'accepted', acceptedAt: time },
    { organization, status: 'pending', createdAt: time },
    {
      organization,
      status: 'rejected',
      rejectedAt: time,
      rejectedBy: user,
      rejectionReason: null,
    },
    { organization, status: 'accepted', acceptedAt: null },
    { organization, status: 'rejected', rejectedAt: time, rejectedBy: null },
  ]);
  const directory = new PrismaOrganizationDirectory({
    organizationUser: { findMany },
  } as unknown as PrismaClient);
  const list = expectSuccess(
    await directory.userOrganizations(UserId.parse('user'))
  );
  expect(list.member).toHaveLength(1);
  expect(list.pending).toHaveLength(1);
  expect(list.rejected).toHaveLength(1);
  expect(list.member[0].joinedAt).toBe(time.toISOString());
  expect(list.pending[0].requestedAt).toBe(time.toISOString());
  expect(list.rejected[0].rejectedAt).toBe(time.toISOString());
  expect(list.rejected[0].rejectedBy).toEqual({
    id: 'user',
    firstName: 'Alice',
    lastName: 'Smith',
    middleName: null,
  });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { userId: 'user' },
      orderBy: { createdAt: 'desc' },
    })
  );
  findMany.mockResolvedValue([{ organization, status: 'unknown' }]);
  expect(await directory.userOrganizations(UserId.parse('user'))).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});

it('restricts the pending inbox to administered organizations and skips request reads without roles', async () => {
  const roles = vi.fn().mockResolvedValue([{ organizationId: 'org' }]);
  const findMany = vi.fn().mockResolvedValue([
    {
      user,
      createdAt: time,
      organizationId: 'org',
      organization: { name: 'Organization' },
    },
  ]);
  const count = vi.fn().mockResolvedValue(1);
  const directory = new PrismaOrganizationDirectory({
    organizationAdminUser: { findMany: roles },
    organizationUser: { findMany, count },
  } as unknown as PrismaClient);
  const result = expectSuccess(
    await directory.pendingForAdmin({ adminId: UserId.parse('admin') })
  );
  expect(result.requests[0]).toEqual({
    organizationId: 'org',
    organizationName: 'Organization',
    requester: {
      id: 'user',
      firstName: 'Alice',
      lastName: 'Smith',
      middleName: null,
    },
    requestedAt: time.toISOString(),
  });
  expect(roles).toHaveBeenCalledWith({
    where: { userId: 'admin' },
    select: { organizationId: true },
  });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { organizationId: { in: ['org'] }, status: 'pending' },
      orderBy: { createdAt: 'asc' },
    })
  );
  roles.mockResolvedValue([]);
  findMany.mockClear();
  count.mockClear();
  expect(
    expectSuccess(
      await directory.pendingForAdmin({ adminId: UserId.parse('outsider') })
    )
  ).toEqual({ requests: [], totalCount: 0 });
  expect(findMany).not.toHaveBeenCalled();
  expect(count).not.toHaveBeenCalled();
});

it('returns pending requests oldest first with a total and immutable request times', async () => {
  const findMany = vi.fn().mockResolvedValue([{ user, createdAt: time }]);
  const count = vi.fn().mockResolvedValue(3);
  const directory = new PrismaOrganizationDirectory({
    organizationUser: { findMany, count },
  } as unknown as PrismaClient);
  const result = expectSuccess(
    await directory.pendingForOrganization({
      organizationId: OrganizationId.parse('org'),
      pagination: { page: PageNumber.parse(2), pageSize: PageSize.parse(1) },
    })
  );
  expect(result).toEqual({
    requests: [
      {
        requester: {
          id: 'user',
          firstName: 'Alice',
          lastName: 'Smith',
          middleName: null,
        },
        requestedAt: time.toISOString(),
      },
    ],
    totalCount: 3,
  });
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { organizationId: 'org', status: 'pending' },
      orderBy: { createdAt: 'asc' },
      skip: 1,
      take: 1,
    })
  );
  expect(count).toHaveBeenCalledWith({
    where: { organizationId: 'org', status: 'pending' },
  });
});

it('returns each tree member once, retaining memberships before applying the person limit', async () => {
  const findMany = vi.fn().mockResolvedValue([
    { user, organization: { name: 'Root' } },
    { user, organization: { name: 'Child' } },
    { user: { ...user, id: 'second' }, organization: { name: 'Child' } },
  ]);
  const directory = new PrismaOrganizationDirectory({
    organizationUser: { findMany },
  } as unknown as PrismaClient);
  const people = expectSuccess(
    await directory.treeMembers({
      organizationIds: [
        OrganizationId.parse('root'),
        OrganizationId.parse('child'),
      ],
      query: ' ALICE ',
      limit: ResultLimit.parse(1),
    })
  );
  expect(people).toHaveLength(1);
  expect(people[0].orgNames).toEqual(['Root', 'Child']);
  expect(people[0].nickname.getValue()).toBe('alice_smith');
  expect(people[0]).not.toHaveProperty('passwordHash');
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({
      where: expect.objectContaining({
        organizationId: { in: ['root', 'child'] },
        status: 'accepted',
        user: {
          OR: ['firstName', 'lastName', 'middleName', 'nickname'].map(
            (field) => ({ [field]: { contains: 'ALICE', mode: 'insensitive' } })
          ),
        },
      }),
      take: 80,
      orderBy: { acceptedAt: 'desc' },
    })
  );
});

it('reads active board members and the earliest administrator with public names only', async () => {
  const findMany = vi.fn().mockResolvedValue([{ user }]);
  const findFirst = vi.fn().mockResolvedValue({ user });
  const directory = new PrismaOrganizationDirectory({
    boardUser: { findMany },
    organizationAdminUser: { findFirst },
  } as unknown as PrismaClient);
  const expected = {
    id: 'user',
    firstName: 'Alice',
    lastName: 'Smith',
    middleName: null,
  };
  expect(
    expectSuccess(await directory.boardMembers(BoardId.parse('board')))
  ).toEqual([expected]);
  expect(findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { boardId: 'board', removedAt: null } })
  );
  expect(
    expectSuccess(await directory.firstAdmin(OrganizationId.parse('org')))
  ).toEqual(expected);
  expect(findFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { organizationId: 'org' },
      orderBy: { createdAt: 'asc' },
    })
  );
  findFirst.mockResolvedValue(null);
  expect(
    expectSuccess(await directory.firstAdmin(OrganizationId.parse('org')))
  ).toBeNull();
});

it.each(['members', 'admins'] as const)(
  'decodes and scopes paginated %s',
  async (kind) => {
    const rows = {
      findMany: vi
        .fn()
        .mockResolvedValue([{ user, acceptedAt: time, createdAt: time }]),
      count: vi.fn().mockResolvedValue(1),
    };
    const client = {
      organizationUser: rows,
      organizationAdminUser: rows,
    } as unknown as PrismaClient;
    const directory = new PrismaOrganizationDirectory(client);
    const input = {
      organizationId: OrganizationId.parse('org'),
      page: PageNumber.parse(2),
      pageSize: PageSize.parse(10),
      query: 'ALICE',
    };
    const page =
      kind === 'members'
        ? expectSuccess(await directory.members(input))
        : expectSuccess(await directory.admins(input));
    const person = 'members' in page ? page.members[0] : page.admins[0];
    expect(person.id).toBe('user');
    expect(person.nickname.getValue()).toBe('alice_smith');
    expect(person).not.toHaveProperty('passwordHash');
    expect('joinedAt' in person ? person.joinedAt : person.createdAt).toBe(
      time.toISOString()
    );
    expect(page.totalCount).toBe(1);
    expect(rows.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: 'org',
          ...(kind === 'members' ? { status: 'accepted' } : {}),
          user: {
            OR: ['firstName', 'lastName', 'middleName', 'nickname'].map(
              (field) => ({
                [field]: { contains: 'ALICE', mode: 'insensitive' },
              })
            ),
          },
        }),
        skip: 10,
        take: 10,
      })
    );
  }
);

it.each([{ firstName: '' }, { id: '' }, { nickname: 'bad nickname' }])(
  'rejects malformed stored member profiles: %j',
  async (invalid) => {
    const directory = new PrismaOrganizationDirectory({
      organizationUser: {
        findMany: vi
          .fn()
          .mockResolvedValue([
            { user: { ...user, ...invalid }, acceptedAt: time },
          ]),
        count: vi.fn().mockResolvedValue(1),
      },
    } as unknown as PrismaClient);
    expect(
      await directory.members({
        organizationId: OrganizationId.parse('org'),
        page: PageNumber.parse(1),
        pageSize: PageSize.parse(20),
      })
    ).toEqual({ success: false, error: 'common.errors.unexpected' });
  }
);

it('retains legacy missing join times but rejects invalid dates and counts', async () => {
  const findMany = vi.fn().mockResolvedValue([{ user, acceptedAt: null }]);
  const count = vi.fn().mockResolvedValue(1);
  const directory = new PrismaOrganizationDirectory({
    organizationUser: { findMany, count },
  } as unknown as PrismaClient);
  const input = {
    organizationId: OrganizationId.parse('org'),
    page: PageNumber.parse(1),
    pageSize: PageSize.parse(20),
  };
  expect(
    expectSuccess(await directory.members(input)).members[0].joinedAt
  ).toBeNull();
  findMany.mockResolvedValue([{ user, acceptedAt: new Date(NaN) }]);
  expect(await directory.members(input)).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
  findMany.mockResolvedValue([{ user, acceptedAt: time }]);
  count.mockResolvedValue(0.5);
  expect(await directory.members(input)).toEqual({
    success: false,
    error: 'common.errors.unexpected',
  });
});
