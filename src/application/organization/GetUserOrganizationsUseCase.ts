/** Validates the current-user reference before reading their organization memberships.
 * The directory port returns typed status-specific projections without exposing ORM rows. */
import { UserId } from '../../domain/shared/EntityIds';
import { Result, failure } from '../../domain/shared/Result';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import {
  OrganizationDirectory,
  DirectoryMemberOrganization,
  DirectoryPendingOrganization,
  DirectoryRejectedOrganization,
  DirectoryUserOrganizations,
} from './OrganizationDirectory';

export type MemberOrganization = DirectoryMemberOrganization;
export type PendingOrganization = DirectoryPendingOrganization;
export type RejectedOrganization = DirectoryRejectedOrganization;
export type GetUserOrganizationsResult = DirectoryUserOrganizations;
export interface GetUserOrganizationsDependencies {
  directory: Pick<OrganizationDirectory, 'userOrganizations'>;
}

export class GetUserOrganizationsUseCase {
  constructor(private readonly deps: GetUserOrganizationsDependencies) {}

  async execute(
    rawUserId: string
  ): Promise<Result<GetUserOrganizationsResult, OrganizationUseCaseFailure>> {
    const userId = UserId.safeParse(rawUserId);

    if (!userId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    return this.deps.directory.userOrganizations(userId.data);
  }
}
