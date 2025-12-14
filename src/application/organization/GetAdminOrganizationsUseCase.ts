import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success } from '../../domain/shared/Result';
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
    userId: string
  ): Promise<Result<GetAdminOrganizationsResult, string>> {
    const organizations =
      await this.deps.organizationRepository.findAdminOrganizationsByUserId(
        userId
      );

    return success({
      organizations,
    });
  }
}
