/** Join-link persistence port uses validated identities, token values and
 * pagination units; free search text and display labels remain projections. */
import { JoinTokenId, OrganizationId } from '../shared/EntityIds';
import { PageNumber, PageSize, ResultCount } from '../shared/Pagination';
import { JoinTokenValue } from './JoinTokenValues';
import { JoinToken } from './JoinToken';

export interface JoinTokenWithCreator {
  joinToken: JoinToken;
  creatorName: string;
}

export interface JoinTokenSearchFilters {
  search?: string;
  page?: PageNumber;
  pageSize?: PageSize;
  activeOnly?: boolean;
}

export interface JoinTokenRepository {
  save(joinToken: JoinToken): Promise<JoinToken>;
  update(joinToken: JoinToken): Promise<JoinToken>;
  findById(id: JoinTokenId): Promise<JoinToken | null>;
  findByToken(token: JoinTokenValue): Promise<JoinToken | null>;
  findByOrganizationId(
    organizationId: OrganizationId,
    filters: JoinTokenSearchFilters
  ): Promise<{ tokens: JoinTokenWithCreator[]; totalCount: ResultCount }>;
  tryIncrementUseCount(id: JoinTokenId): Promise<boolean>;
}
