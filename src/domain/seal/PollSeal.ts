/** Aggregate root: immutable committed record plus controlled anchor lifecycle.
 * The root digest is its stable identity; database surrogate IDs stay in adapters. */
import {
  AnchorFailure,
  AnchorSubmission,
  confirmedAnchor,
  failedAnchor,
  SealAnchor,
  submittedAnchor,
  supersededAnchor,
  refreshedAnchor,
  validateAnchor,
  parseAnchor,
} from './SealAnchor';
import { BitcoinAnchorEvidence, PendingAnchorEvidence } from './AnchorProvider';
import { requireSeal, SealDomainCodes, sealResult } from './SealDomainCodes';
import { validateRecord } from './RecordValidation';
import { SealedRecord, SealManifest } from './RecordFormat';
import { PollId, Digest, UtcTimestamp } from './SealValues';

export class PollSeal {
  private anchorStates: SealAnchor[] = [];
  private constructor(
    private readonly contents: SealedRecord,
    private readonly parsedManifest: SealManifest,
    private readonly digest: Digest
  ) {}
  static fromRecord(record: SealedRecord): PollSeal {
    const parsed = validateRecord(record);

    return new PollSeal(
      structuredClone(record),
      parsed.manifest,
      parsed.rootDigest
    );
  }
  static reconstitute(record: SealedRecord, anchors: unknown = []) {
    return sealResult(() => {
      const seal = PollSeal.fromRecord(record);
      requireSeal(Array.isArray(anchors));
      const parsed = anchors.map((anchor) =>
        parseAnchor(anchor, seal.manifest.sealedAt)
      );
      requireSeal(parsed.filter((a) => a.status !== 'SUPERSEDED').length <= 1);
      requireSeal(new Set(parsed.map((a) => a.id)).size === parsed.length);
      seal.anchorStates = parsed;

      return seal;
    });
  }
  get record(): SealedRecord {
    return structuredClone(this.contents);
  }
  get manifest(): SealManifest {
    return structuredClone(this.parsedManifest);
  }
  get pollId(): PollId {
    return this.manifest.pollId;
  }
  get rootDigest(): Digest {
    return this.digest;
  }
  get anchors(): SealAnchor[] {
    return structuredClone(this.anchorStates);
  }
  activeAnchor(): SealAnchor | null {
    return structuredClone(
      this.anchorStates.find((anchor) => anchor.status !== 'SUPERSEDED') ?? null
    );
  }
  private saveAnchor(anchor: SealAnchor): void {
    validateAnchor(anchor, this.manifest.sealedAt);
    requireSeal(
      !this.anchorStates.some(
        (a) => a.id === anchor.id && a.status === 'SUPERSEDED'
      ),
      SealDomainCodes.SEAL_ANCHOR_ILLEGAL_TRANSITION
    );
    const index = this.anchorStates.findIndex((a) => a.id === anchor.id);

    if (index < 0) {
      this.anchorStates.push(anchor);
    } else {
      this.anchorStates[index] = anchor;
    }
  }
  supersedeAnchor(replacement: AnchorSubmission | AnchorFailure) {
    return sealResult(() => {
      const previous = supersededAnchor(this.activeAnchor(), replacement.at);
      requireSeal(
        !this.anchorStates.some((a) => a.id === replacement.id),
        SealDomainCodes.SEAL_ANCHOR_ILLEGAL_TRANSITION
      );
      const next =
        'evidence' in replacement
          ? submittedAnchor(null, replacement, this.rootDigest)
          : failedAnchor(null, replacement);
      // Both candidates validate before either changes the aggregate.
      validateAnchor(previous, this.manifest.sealedAt);
      validateAnchor(next, this.manifest.sealedAt);
      this.saveAnchor(previous);
      this.saveAnchor(next);
    });
  }
  refreshAnchor(evidence: PendingAnchorEvidence, at: UtcTimestamp) {
    return sealResult(() => {
      this.saveAnchor(
        refreshedAnchor(this.activeAnchor(), evidence, at, this.rootDigest)
      );
    });
  }
  confirmAnchor(evidence: BitcoinAnchorEvidence, at: UtcTimestamp) {
    return sealResult(() => {
      this.saveAnchor(
        confirmedAnchor(this.activeAnchor(), evidence, at, this.rootDigest)
      );
    });
  }
  failAnchor(command: AnchorFailure) {
    return sealResult(() => {
      requireSeal(command.at >= this.manifest.sealedAt);
      this.saveAnchor(failedAnchor(this.activeAnchor(), command));
    });
  }
  submitAnchor(command: AnchorSubmission) {
    return sealResult(() => {
      requireSeal(command.at >= this.manifest.sealedAt);
      this.saveAnchor(
        submittedAnchor(this.activeAnchor(), command, this.rootDigest)
      );
    });
  }
}
