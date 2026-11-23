/** Parent-link request persistence uses validated request and organization IDs.
 * Adapters validate stored status/decision metadata before returning aggregates. */
import { JoinParentRequestId, OrganizationId } from '../shared/EntityIds';
import { JoinParentRequest } from './JoinParentRequest';

export interface JoinParentRequestRepository {
  save(request: JoinParentRequest): Promise<JoinParentRequest>;
  findById(id: JoinParentRequestId): Promise<JoinParentRequest | null>;
  findPendingByChildOrgId(
    childOrgId: OrganizationId
  ): Promise<JoinParentRequest | null>;
  findPendingByParentOrgId(
    parentOrgId: OrganizationId
  ): Promise<JoinParentRequest[]>;
  findAllByChildOrgId(childOrgId: OrganizationId): Promise<JoinParentRequest[]>;
  findAllByParentOrgId(
    parentOrgId: OrganizationId
  ): Promise<JoinParentRequest[]>;
  update(request: JoinParentRequest): Promise<JoinParentRequest>;
  delete(id: JoinParentRequestId): Promise<void>;
}
