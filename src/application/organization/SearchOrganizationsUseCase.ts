import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success } from '../../domain/shared/Result';

export interface SearchOrganizationsInput {
  query: string;
  excludeIds: string[];
  limit: number;
}

export type SearchOrganizationsResult = Array<{ id: string; name: string }>;

export interface SearchOrganizationsDependencies {
  organizationRepository: OrganizationRepository;
}

export class SearchOrganizationsUseCase {
  constructor(private deps: SearchOrganizationsDependencies) {}

  async execute(
    input: SearchOrganizationsInput
  ): Promise<Result<SearchOrganizationsResult, string>> {
    const trimmed = input.query.trim();

    if (!trimmed) {
      return success([]);
    }

    const results = await this.deps.organizationRepository.searchByNameFuzzy(
      trimmed,
      input.excludeIds,
      input.limit
    );

    return success(results);
  }
}
