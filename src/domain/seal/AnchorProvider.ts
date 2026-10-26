/** Outbound timestamp port. Adapters must parse proof bytes, check their committed
 * digest, and verify Bitcoin evidence before constructing these assertions.
 * Domain checks consistency of the assertions; it does not parse OTS or trust status labels. */
import { Result } from '../shared/Result';
import { AnchorProof, BitcoinHeight, Digest, UtcTimestamp } from './SealValues';

export type AnchorProviderName = 'opentimestamps' | 'stub';
export type PendingAnchorEvidence = {
  kind: 'pending' | 'simulated';
  rootDigest: Digest;
  proof: AnchorProof;
};
export type BitcoinAnchorEvidence = {
  kind: 'bitcoin';
  rootDigest: Digest;
  proof: AnchorProof;
  bitcoinHeight: BitcoinHeight;
  bitcoinTime: UtcTimestamp;
};
export type AnchorEvidence = PendingAnchorEvidence | BitcoinAnchorEvidence;
export interface AnchorProvider {
  readonly name: AnchorProviderName;
  submit(rootDigest: Digest): Promise<Result<PendingAnchorEvidence, string>>;
  upgrade(
    rootDigest: Digest,
    proof: AnchorProof
  ): Promise<Result<AnchorEvidence, string>>;
}
