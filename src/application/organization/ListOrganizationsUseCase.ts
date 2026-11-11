/** Organization application boundary validates external request identities/units
 * before querying ports or invoking domain policies. */
import { ResultCount } from '../../domain/shared/Pagination';
import { UserId } from '../../domain/shared/EntityIds';
import { PageNumber, PageSize } from '../../domain/shared/Pagination';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import {
  OrganizationRepository,
  OrganizationWithStats,
} from '../../domain/organization/OrganizationRepository';
import { Result, success, failure } from '../../domain/shared/Result';

export interface ListOrganizationsInput {
  search?: string;
  page?: number;
  pageSize?: number;
  includeArchived?: boolean;
}

export interface ListOrganizationsResult {
  organizations: OrganizationWithStats[];
  totalCount: ResultCount;
}

export interface ListOrganizationsDependencies {
  organizationRepository: OrganizationRepository;
}

export class ListOrganizationsUseCase {
  constructor(private deps: ListOrganizationsDependencies) {}

  async execute(
    input: ListOrganizationsInput = {},
    rawUserId?: string
  ): Promise<Result<ListOrganizationsResult, OrganizationUseCaseFailure>> {
    const parsedUserId = UserId.optional().safeParse(rawUserId);

    if (!parsedUserId.success) {
      return failure(OrganizationErrors.USER_NOT_FOUND);
    }

    const userId = parsedUserId.data;

    const parsedPage = PageNumber.optional().safeParse(input.page);

    if (!parsedPage.success) {
      return failure('common.errors.unexpected');
    }

    const parsedPageSize = PageSize.optional().safeParse(input.pageSize);

    if (!parsedPageSize.success) {
      return failure('common.errors.unexpected');
    }

    const command = {
      ...input,
      page: parsedPage.data,
      pageSize: parsedPageSize.data,
    };

    const result =
      await this.deps.organizationRepository.searchOrganizationsWithStats(
        command,
        userId
      );

    return success(result);
  }
}
