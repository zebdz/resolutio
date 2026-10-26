/** Compile-only client examples. Unused @ts-expect-error directives fail the contract test. */
import { deriveSalt } from '../VoteLeaf';
import { PollSeal } from '../PollSeal';
import { PollSealRepository } from '../PollSealRepository';
import { parseVotePreimage } from '../VoteLeaf';
import { SealAnchor } from '../SealAnchor';
import { AnchorProvider, BitcoinAnchorEvidence } from '../AnchorProvider';
import { UtcTimestamp, BitcoinHeight, FencingToken } from '../SealValues';
import { RegisterEntry } from '../RecordFormat';

declare const secret: Parameters<typeof deriveSalt>[0];
declare const questionId: Parameters<typeof deriveSalt>[1];
declare const answerId: Parameters<typeof deriveSalt>[2];

deriveSalt(secret, questionId, answerId);
// @ts-expect-error Answer and question IDs have different meanings.
deriveSalt(secret, answerId, questionId);
// @ts-expect-error A raw string has not been validated as a receipt secret.
deriveSalt('unvalidated', questionId, answerId);

declare const seal: PollSeal;
declare const repository: PollSealRepository;
declare const vote: ReturnType<typeof parseVotePreimage>;
repository.findByPollId(seal.pollId);
repository.findByRootDigest(seal.rootDigest);
// @ts-expect-error A user ID is not a poll ID.
repository.findByPollId(vote.userId);
// @ts-expect-error A receipt secret is not a public digest.
repository.findByRootDigest(secret);
declare const provider: AnchorProvider;
provider.submit(seal.rootDigest);
// @ts-expect-error A secret must not be submitted as a public commitment.
provider.submit(secret);
declare const height: BitcoinHeight;
declare const time: UtcTimestamp;
declare const bitcoinEvidence: BitcoinAnchorEvidence;
seal.confirmAnchor(bitcoinEvidence, time);
// @ts-expect-error Timestamps must be validated before use in the domain.
seal.confirmAnchor(bitcoinEvidence, '2026-09-11');
// @ts-expect-error Heights and retry counters are different domain units.
const attempts: SealAnchor['attempts'] = height;
// @ts-expect-error Persistence requires a validated fencing token.
repository.saveAnchors(seal, BigInt(0));
declare const token: FencingToken;
repository.saveAnchors(seal, token);
// @ts-expect-error An unbounded tally sum cannot be used as a bounded row weight.
const unboundedRow: typeof vote.weight = vote.weight.add(vote.weight);
declare const holding: RegisterEntry['holdings'][number];
// @ts-expect-error Holding size and ownership share are different units and precisions.
const size: typeof holding.size = holding.share;
// @ts-expect-error Domain votes are immutable snapshots.
vote.pollId = seal.pollId;

declare const anchor: SealAnchor;

if (anchor.status === 'CONFIRMED') {
  const proof: Uint8Array = anchor.confirmedProof;
  const height: number = anchor.bitcoinHeight;
  const confirmedAt: string = anchor.confirmedAt;
  const provider: 'opentimestamps' = anchor.provider;
  // @ts-expect-error A confirmed anchor requires its evidence.
  const missingProof: SealAnchor = { ...anchor, confirmedProof: null };
  // @ts-expect-error Stub anchors cannot claim Bitcoin confirmation.
  const simulatedConfirmation: SealAnchor = { ...anchor, provider: 'stub' };
}

if (anchor.status === 'FAILED') {
  const retryAt: string = anchor.nextAttemptAt;
  const error: string = anchor.lastError;

  if (anchor.pendingProof !== null) {
    const submittedAt: UtcTimestamp = anchor.submittedAt;
  }
}
