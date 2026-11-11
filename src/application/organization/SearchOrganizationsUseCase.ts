/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { OrganizationName } from '../../domain/organization/OrganizationValues';

import { OrganizationId } from '../../domain/shared/EntityIds';
import { ResultLimit } from '../../domain/shared/Pagination';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { OrganizationRepository } from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export interface SearchOrganizationsInput {
  query: string;
  excludeIds: string[];
  limit: number;
}

export type SearchOrganizationsResult = Array<{
  id: OrganizationId;
  name: OrganizationName;
}>;

export interface SearchOrganizationsDependencies {
  organizationRepository: OrganizationRepository;
}

export class SearchOrganizationsUseCase {
  constructor(private deps: SearchOrganizationsDependencies) {}

  async execute(
    input: SearchOrganizationsInput
  ): Promise<Result<SearchOrganizationsResult, OrganizationUseCaseFailure>> {
    const parsedExcludeIds = OrganizationId.array().safeParse(input.excludeIds);

    if (!parsedExcludeIds.success) {
      return failure(OrganizationErrors.NOT_FOUND);
    }

    const parsedLimit = ResultLimit.safeParse(input.limit);

    if (!parsedLimit.success) {
      return failure('common.errors.unexpected');
    }

    const command = {
      ...input,
      excludeIds: parsedExcludeIds.data,
      limit: parsedLimit.data,
    };

    const trimmed = command.query.trim();

    if (!trimmed) {
      return success([]);
    }

    const results = await this.deps.organizationRepository.searchByNameFuzzy(
      trimmed,
      command.excludeIds,
      command.limit
    );

    return success(results);
  }
}
