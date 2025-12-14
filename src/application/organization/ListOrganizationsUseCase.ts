import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success } from '../../domain/shared/Result';
import { Organization } from '../../domain/organization/Organization';

export interface ListOrganizationsResult {
  organizations: Array<{
    organization: Organization;
    memberCount: number;
    firstAdmin: { id: string; firstName: string; lastName: string } | null;
  }>;
}

export interface ListOrganizationsDependencies {
  organizationRepository: OrganizationRepository;
}

export class ListOrganizationsUseCase {
  constructor(private deps: ListOrganizationsDependencies) {}

  async execute(
    userId?: string
  ): Promise<Result<ListOrganizationsResult, string>> {
    const organizationsWithStats =
      await this.deps.organizationRepository.findAllWithStats(userId);

    return success({
      organizations: organizationsWithStats,
    });
  }
}
