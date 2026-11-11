/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { UserId } from '../../domain/shared/EntityIds';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';
import { Organization } from '../../domain/organization/Organization';

export interface GetAdminOrganizationsResult {
  organizations: Organization[];
}

export interface GetAdminOrganizationsDependencies {
  organizationRepository: OrganizationRepository;
}

export class GetAdminOrganizationsUseCase {
  constructor(private deps: GetAdminOrganizationsDependencies) {}

  async execute(
    rawUserId: string
  ): Promise<Result<GetAdminOrganizationsResult, OrganizationUseCaseFailure>> {
    const parsedUserId = UserId.safeParse(rawUserId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const userId = parsedUserId.data;

    const organizations =
      await this.deps.organizationRepository.findAdminOrganizationsByUserId(
        userId
      );

    return success({
      organizations,
    });
  }
}
