/** Validates the actor and pagination for the administrator pending-request inbox.
 * The typed directory port restricts the query to that actor's organization roles. */
import { ResultCount } from '../../domain/shared/Pagination';
import {
  OrganizationDirectory,
  DirectoryAdminPendingRequest,
} from './OrganizationDirectory';

import { UserId } from '../../domain/shared/EntityIds';
import { PageNumber, PageSize } from '../../domain/shared/Pagination';
import { z } from 'zod';
import {
  OrganizationErrors,
  OrganizationUseCaseFailure,
} from './OrganizationErrors';
import { Result, failure } from '../../domain/shared/Result';

export type PendingRequest = DirectoryAdminPendingRequest;

export interface GetPendingRequestsResult {
  requests: PendingRequest[];
  totalCount: ResultCount;
}

export interface GetPendingRequestsPagination {
  page: number;
  pageSize: number;
}

export interface GetPendingRequestsDependencies {
  directory: Pick<OrganizationDirectory, 'pendingForAdmin'>;
}

export class GetPendingRequestsUseCase {
  constructor(private deps: GetPendingRequestsDependencies) {}

  async execute(
    rawAdminId: string,
    rawPagination?: GetPendingRequestsPagination
  ): Promise<Result<GetPendingRequestsResult, OrganizationUseCaseFailure>> {
    const parsedAdminId = UserId.safeParse(rawAdminId);

    if (!parsedAdminId.success) {
      return failure(OrganizationErrors.NOT_ADMIN);
    }

    const adminId = parsedAdminId.data;
    const parsedPagination = z
      .object({ page: PageNumber, pageSize: PageSize })
      .optional()
      .safeParse(rawPagination);

    if (!parsedPagination.success) {
      return failure('common.errors.unexpected');
    }

    const pagination = parsedPagination.data;

    return this.deps.directory.pendingForAdmin({ adminId, pagination });
  }
}
