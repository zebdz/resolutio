import {
  OrganizationRepository,
  OrganizationSearchFilters,
  OrganizationWithStats,
} from '../../domain/organization/OrganizationRepository';
import { Result, success } from '../../domain/shared/Result';

export type ListOrganizationsInput = OrganizationSearchFilters;

export interface ListOrganizationsResult {
  organizations: OrganizationWithStats[];
  totalCount: number;
}

export interface ListOrganizationsDependencies {
  organizationRepository: OrganizationRepository;
}

export class ListOrganizationsUseCase {
  constructor(private deps: ListOrganizationsDependencies) {}

  async execute(
    input: ListOrganizationsInput = {},
    userId?: string
  ): Promise<Result<ListOrganizationsResult, string>> {
    const result =
      await this.deps.organizationRepository.searchOrganizationsWithStats(
        input,
        userId
      );

    return success(result);
  }
}
