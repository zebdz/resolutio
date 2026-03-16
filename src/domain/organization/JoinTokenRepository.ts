import { JoinToken } from './JoinToken';

export interface JoinTokenWithCreator {
  joinToken: JoinToken;
  creatorName: string;
}

export interface JoinTokenSearchFilters {
  search?: string;
  page?: number;
  pageSize?: number;
  activeOnly?: boolean;
}

export interface JoinTokenRepository {
  save(joinToken: JoinToken): Promise<JoinToken>;
  update(joinToken: JoinToken): Promise<JoinToken>;
  findById(id: string): Promise<JoinToken | null>;
  findByToken(token: string): Promise<JoinToken | null>;
  findByOrganizationId(
    organizationId: string,
    filters: JoinTokenSearchFilters
  ): Promise<{ tokens: JoinTokenWithCreator[]; totalCount: number }>;
  tryIncrementUseCount(id: string): Promise<boolean>;
}
