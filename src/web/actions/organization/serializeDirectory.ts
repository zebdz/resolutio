/** Explicit directory DTO mapping prevents domain objects from reaching clients.
 * Preserve the existing nickname strings and Date/null action payloads. */
import {
  DirectoryAdmin,
  DirectoryMember,
  DirectoryPerson,
  DirectoryAdminPendingRequest,
  DirectoryUserOrganizations,
  DirectoryUserOrganization,
} from '@/application/organization/OrganizationDirectory';
import { OrganizationId } from '@/domain/shared/EntityIds';
import { PendingRequest as OrganizationPendingRequest } from '@/application/organization/GetOrganizationPendingRequestsUseCase';
import { Instant } from '@/domain/shared/Instant';
import type { OrganizationDetailsResult } from '@/application/organization/GetOrganizationDetailsUseCase';
import type {
  OrganizationTreeNode,
  OrganizationWithStats,
} from '@/domain/organization/OrganizationRepository';
import type { User } from '@/domain/user/User';

export function serializeOrganizationSummary(item: OrganizationWithStats) {
  return {
    id: item.organization.id,
    name: item.organization.name,
    description: item.organization.description,
    memberCount: item.memberCount,
    firstAdmin: item.firstAdmin === null ? null : personFields(item.firstAdmin),
    parentOrg:
      item.parentOrg === null
        ? null
        : { id: item.parentOrg.id, name: item.parentOrg.name },
  };
}

/** Candidate lookups expose only the address preview allowed by the user's privacy choice. */
export function serializeDirectoryUserSearch(user: User) {
  return {
    id: user.id,
    firstName: user.firstName,
    lastName: user.lastName,
    middleName: user.middleName,
    nickname: user.nickname.getValue(),
    address:
      user.allowFindByAddress && user.address
        ? { city: user.address.city, street: user.address.street }
        : undefined,
  };
}

export type RootMembershipSettingView = {
  allowed: boolean;
  rootOrgName: string;
} | null;

function serializeOrganizationTree(
  node: OrganizationTreeNode
): OrganizationTreeNode {
  return {
    id: node.id,
    name: node.name,
    memberCount: node.memberCount,
    children: node.children.map(serializeOrganizationTree),
  };
}

export function serializeOrganizationDetails(
  details: OrganizationDetailsResult,
  rootOrgMultiMembershipSetting: RootMembershipSettingView
) {
  const org = details.organization;

  return {
    organization: {
      id: org.id,
      name: org.name,
      description: org.description,
      parentId: org.parentId,
      allowMultiTreeMembership: org.allowMultiTreeMembership,
      createdAt: org.createdAt,
    },
    boards: details.boards.map(
      ({ board, memberCount, members, isUserMember }) => ({
        id: board.id,
        name: board.name,
        memberCount,
        members: members.map(personFields),
        isUserMember,
      })
    ),
    isUserMember: details.isUserMember,
    isUserAdmin: details.isUserAdmin,
    firstAdmin:
      details.firstAdmin === null ? null : personFields(details.firstAdmin),
    ancestors: details.ancestors.map(({ id, name, memberCount }) => ({
      id,
      name,
      memberCount,
    })),
    hierarchyTree: serializeOrganizationTree(details.hierarchyTree),
    rootOrgMultiMembershipSetting,
  };
}

export type OrganizationDetailsView = ReturnType<
  typeof serializeOrganizationDetails
>;

function personFields(person: DirectoryPerson) {
  return {
    id: person.id,
    firstName: person.firstName,
    lastName: person.lastName,
    middleName: person.middleName,
  };
}

export function serializeDirectoryAdmin(admin: DirectoryAdmin) {
  return {
    ...personFields(admin),
    nickname: admin.nickname.getValue(),
    createdAt: Instant.toDate(admin.createdAt),
  };
}

export function serializeDirectoryMember(member: DirectoryMember) {
  return {
    ...personFields(member),
    nickname: member.nickname.getValue(),
    joinedAt: member.joinedAt === null ? null : Instant.toDate(member.joinedAt),
  };
}

export function serializeOrganizationPendingRequest(
  request: OrganizationPendingRequest
) {
  return {
    userId: request.userId,
    firstName: request.firstName,
    lastName: request.lastName,
    middleName: request.middleName ?? undefined,
    requestedAt: Instant.toDate(request.requestedAt),
  };
}

export function serializeAdminPendingRequest(
  request: DirectoryAdminPendingRequest
) {
  return {
    organizationId: request.organizationId,
    organizationName: request.organizationName,
    requester: personFields(request.requester),
    requestedAt: Instant.toDate(request.requestedAt),
  };
}

function organizationFields(item: DirectoryUserOrganization) {
  return {
    id: item.organization.id,
    name: item.organization.name,
    description: item.organization.description,
    parentOrg:
      item.parentOrg === null
        ? null
        : { id: item.parentOrg.id, name: item.parentOrg.name },
  };
}

export function serializeUserOrganizations(
  list: DirectoryUserOrganizations,
  hasProperties: ReadonlyMap<OrganizationId, boolean>
) {
  return {
    member: list.member.map((item) => ({
      ...organizationFields(item),
      joinedAt: Instant.toDate(item.joinedAt),
      archivedAt: item.organization.archivedAt,
      hasProperties: hasProperties.get(item.organization.id) ?? false,
    })),
    pending: list.pending.map((item) => ({
      ...organizationFields(item),
      requestedAt: Instant.toDate(item.requestedAt),
    })),
    rejected: list.rejected.map((item) => ({
      ...organizationFields(item),
      rejectedAt: Instant.toDate(item.rejectedAt),
      rejectionReason: item.rejectionReason,
      rejectedBy: personFields(item.rejectedBy),
    })),
  };
}
