/** Directory application boundaries must authorize before querying public profiles.
 * The same tests exercise member/admin lists and the stricter tree-search gate. */
import { expect, it, vi } from 'vitest';
import { Organization } from '@/domain/organization/Organization';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { ResultCount } from '@/domain/shared/Pagination';
import { success } from '@/domain/shared/Result';
import { GetOrgMembersUseCase } from '../GetOrgMembersUseCase';
import { GetOrgAdminsPaginatedUseCase } from '../GetOrgAdminsPaginatedUseCase';
import { SearchOrgTreeMembersUseCase } from '../SearchOrgTreeMembersUseCase';

const organization = Organization.reconstitute({
  id: 'root',
  name: 'Root',
  description: 'Organization',
  createdById: 'creator',
  createdAt: new Date('2026-01-01'),
  archivedAt: null,
  parentId: null,
  allowMultiTreeMembership: false,
});

it.each(['outsider', 'member', 'admin', 'superadmin'] as const)(
  'limits directory reads for an %s',
  async (role) => {
    const directory = {
      members: vi
        .fn()
        .mockResolvedValue(
          success({ members: [], totalCount: ResultCount.parse(0) })
        ),
      admins: vi
        .fn()
        .mockResolvedValue(
          success({ admins: [], totalCount: ResultCount.parse(0) })
        ),
      treeMembers: vi.fn().mockResolvedValue(success([])),
    };
    const deps = {
      directory,
      organizationRepository: {
        findById: vi.fn().mockResolvedValue(organization),
        isUserMember: vi.fn().mockResolvedValue(role === 'member'),
        isUserAdmin: vi.fn().mockResolvedValue(role === 'admin'),
        getDescendantIds: vi
          .fn()
          .mockResolvedValue([OrganizationId.parse('child')]),
      },
      userRepository: {
        isSuperAdmin: vi.fn().mockResolvedValue(role === 'superadmin'),
      },
    };
    const input = {
      organizationId: 'root',
      actorUserId: 'actor',
      page: 1,
      pageSize: 20,
    };
    expect((await new GetOrgMembersUseCase(deps).execute(input)).success).toBe(
      role !== 'outsider'
    );
    expect(
      (await new GetOrgAdminsPaginatedUseCase(deps).execute(input)).success
    ).toBe(role !== 'outsider');
    const treeAllowed = role === 'admin' || role === 'superadmin';
    expect(
      (
        await new SearchOrgTreeMembersUseCase(deps).execute({
          rootOrganizationId: 'root',
          actorUserId: 'actor',
          limit: 20,
          query: '',
        })
      ).success
    ).toBe(treeAllowed);
    expect(directory.members).toHaveBeenCalledTimes(
      role === 'outsider' ? 0 : 1
    );
    expect(directory.admins).toHaveBeenCalledTimes(role === 'outsider' ? 0 : 1);
    expect(directory.treeMembers).toHaveBeenCalledTimes(treeAllowed ? 1 : 0);

    if (treeAllowed) {
      expect(directory.treeMembers).toHaveBeenCalledWith({
        organizationIds: ['root', 'child'],
        query: '',
        limit: 20,
      });
    }
  }
);
