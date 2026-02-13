import { JoinParentRequest } from './JoinParentRequest';

export interface JoinParentRequestRepository {
  save(request: JoinParentRequest): Promise<JoinParentRequest>;
  findById(id: string): Promise<JoinParentRequest | null>;
  findPendingByChildOrgId(
    childOrgId: string
  ): Promise<JoinParentRequest | null>;
  findPendingByParentOrgId(parentOrgId: string): Promise<JoinParentRequest[]>;
  findAllByChildOrgId(childOrgId: string): Promise<JoinParentRequest[]>;
  findAllByParentOrgId(parentOrgId: string): Promise<JoinParentRequest[]>;
  update(request: JoinParentRequest): Promise<JoinParentRequest>;
  delete(id: string): Promise<void>;
}
