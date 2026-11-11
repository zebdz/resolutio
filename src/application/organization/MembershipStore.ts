/** Persistence port for membership transitions produced by the domain policy.
 * Core references use the organization/user pair; adapters own surrogate row IDs. */
import {
  MembershipReference,
  MembershipStatus,
  MembershipRequestChange,
  MembershipDecision,
  MembershipAcceptance,
} from '../../domain/organization/MembershipPolicy';
import { Result } from '../../domain/shared/Result';

export type MembershipStoreFailure = 'common.errors.unexpected';
export interface MembershipStore {
  saveDecision(
    reference: MembershipReference,
    decision: MembershipDecision
  ): Promise<Result<void, MembershipStoreFailure>>;
  acceptInvitation(
    reference: MembershipReference,
    acceptance: MembershipAcceptance
  ): Promise<Result<void, MembershipStoreFailure>>;
  findStatus(
    reference: MembershipReference
  ): Promise<Result<MembershipStatus | null, MembershipStoreFailure>>;
  saveRequest(
    reference: MembershipReference,
    change: MembershipRequestChange
  ): Promise<Result<void, MembershipStoreFailure>>;
}
