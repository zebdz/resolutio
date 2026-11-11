/** Read port for organization membership displays, separate from aggregate writes.
 * Adapters decode stored scalars; application callers authorize access before reading. */
import { BoardId, OrganizationId, UserId } from '../../domain/shared/EntityIds';
import { Instant } from '../../domain/shared/Instant';
import {
  PageNumber,
  PageSize,
  ResultCount,
  ResultLimit,
} from '../../domain/shared/Pagination';
import { FirstName, LastName, MiddleName } from '../../domain/user/UserValues';
import { Nickname } from '../../domain/user/Nickname';
import {
  MemberCount,
  OrganizationName,
} from '../../domain/organization/OrganizationValues';
import { Result } from '../../domain/shared/Result';
import { Organization } from '../../domain/organization/Organization';
import { MembershipRejectionReason } from '../../domain/organization/MembershipPolicy';

export type DirectoryFailure = 'common.errors.unexpected';

export interface DirectoryPerson {
  readonly id: UserId;
  readonly firstName: FirstName;
  readonly lastName: LastName;
  readonly middleName: MiddleName | null;
}
export type DirectoryMember = DirectoryPerson & {
  readonly nickname: Nickname;
  readonly joinedAt: Instant | null;
};
export type DirectoryAdmin = DirectoryPerson & {
  readonly nickname: Nickname;
  readonly createdAt: Instant;
};
export type DirectoryTreeMember = DirectoryPerson & {
  readonly nickname: Nickname;
  // Organization names for the memberships returned within the tree search.
  readonly orgNames: OrganizationName[];
};
export interface DirectoryTreeQuery {
  readonly organizationIds: readonly OrganizationId[];
  readonly query: string;
  readonly limit: ResultLimit;
}
export interface DirectoryQuery {
  readonly organizationId: OrganizationId;
  readonly page: PageNumber;
  readonly pageSize: PageSize;
  readonly query?: string;
}

export interface DirectoryPagination {
  readonly page: PageNumber;
  readonly pageSize: PageSize;
}
export interface DirectoryPendingRequest {
  readonly requester: DirectoryPerson;
  readonly requestedAt: Instant;
}
export interface OrganizationPendingQuery {
  readonly organizationId: OrganizationId;
  readonly pagination?: DirectoryPagination;
}
export interface DirectoryAdminPendingRequest extends DirectoryPendingRequest {
  readonly organizationId: OrganizationId;
  readonly organizationName: OrganizationName;
}
export interface AdminPendingQuery {
  readonly adminId: UserId;
  readonly pagination?: DirectoryPagination;
}

export interface DirectoryUserOrganization {
  readonly organization: Organization;
  readonly parentOrg: {
    readonly id: OrganizationId;
    readonly name: OrganizationName;
  } | null;
}
export type DirectoryMemberOrganization = DirectoryUserOrganization & {
  readonly joinedAt: Instant;
};
export type DirectoryPendingOrganization = DirectoryUserOrganization & {
  readonly requestedAt: Instant;
};
export type DirectoryRejectedOrganization = DirectoryUserOrganization & {
  readonly rejectedAt: Instant;
  readonly rejectionReason: MembershipRejectionReason | null;
  readonly rejectedBy: DirectoryPerson;
};
export interface DirectoryUserOrganizations {
  member: DirectoryMemberOrganization[];
  pending: DirectoryPendingOrganization[];
  rejected: DirectoryRejectedOrganization[];
}

export interface OrganizationDirectory {
  userOrganizations(
    userId: UserId
  ): Promise<Result<DirectoryUserOrganizations, DirectoryFailure>>;
  pendingForAdmin(
    query: AdminPendingQuery
  ): Promise<
    Result<
      { requests: DirectoryAdminPendingRequest[]; totalCount: ResultCount },
      DirectoryFailure
    >
  >;
  pendingForOrganization(
    query: OrganizationPendingQuery
  ): Promise<
    Result<
      { requests: DirectoryPendingRequest[]; totalCount: ResultCount },
      DirectoryFailure
    >
  >;
  treeMembers(
    query: DirectoryTreeQuery
  ): Promise<Result<DirectoryTreeMember[], DirectoryFailure>>;
  boardMembers(
    boardId: BoardId
  ): Promise<Result<DirectoryPerson[], DirectoryFailure>>;
  firstAdmin(
    organizationId: OrganizationId
  ): Promise<Result<DirectoryPerson | null, DirectoryFailure>>;
  members(
    query: DirectoryQuery
  ): Promise<
    Result<
      { members: DirectoryMember[]; totalCount: ResultCount },
      DirectoryFailure
    >
  >;
  admins(
    query: DirectoryQuery
  ): Promise<
    Result<
      { admins: DirectoryAdmin[]; totalCount: ResultCount },
      DirectoryFailure
    >
  >;
  countAcceptedMembers(
    organizationId: OrganizationId
  ): Promise<Result<MemberCount, DirectoryFailure>>;
}
