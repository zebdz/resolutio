/** Project validated immutable records into public, authorized-section and own-vote downloads.
 * Viewer permissions are resolved on the server. Only sealed votes establish own-proof eligibility. */
import { PollSealRepository } from '@/domain/seal/PollSealRepository';
import { PollId, UserId, Digest } from '@/domain/seal/SealValues';
import { SealAnchor } from '@/domain/seal/SealAnchor';
import { SealPersistenceFailureCode } from '@/domain/seal/SealPersistenceFailureCode';
import { MerkleTree } from '@/domain/seal/MerkleTree';
import { Result, success, failure } from '@/domain/shared/Result';

export interface SectionPermissions {
  readonly results: boolean;
  readonly names: boolean;
  readonly signers: boolean;
}
export interface SealPermissions {
  forViewer(
    pollId: PollId,
    userId: UserId
  ): Promise<Result<SectionPermissions, 'common.errors.unexpected'>>;
}
export interface PublishedSeal {
  readonly manifest: string;
  readonly rootDigest: Digest;
  readonly anchor: SealAnchor | null;
}
export interface SealExportReader extends Pick<
  PollSealRepository,
  'findByPollId'
> {
  findPublishedByPollId(
    pollId: PollId
  ): Promise<Result<PublishedSeal | null, SealPersistenceFailureCode>>;
}

function publicAnchor(anchor: SealAnchor | null) {
  if (!anchor) {
    return { kind: 'awaitingSubmission' } as const;
  }

  if (anchor.status === 'CONFIRMED') {
    return {
      kind: 'bitcoin',
      height: anchor.bitcoinHeight,
      time: anchor.bitcoinTime,
    } as const;
  }

  if (anchor.status === 'FAILED') {
    return { kind: 'failed', provider: anchor.provider } as const;
  }

  return {
    kind: anchor.provider === 'stub' ? 'simulated' : 'pending',
  } as const;
}

export class SealExports {
  constructor(
    private readonly seals: SealExportReader,
    private readonly permissions: SealPermissions
  ) {}
  private async load(pollId: PollId) {
    const result = await this.seals.findByPollId(pollId);

    if (!result.success) {
      return result;
    }

    return result.value
      ? success(result.value)
      : failure('seal.errors.notFound' as const);
  }
  private async published(pollId: PollId) {
    const result = await this.seals.findPublishedByPollId(pollId);

    if (!result.success) {
      return result;
    }

    return result.value
      ? success(result.value)
      : failure('seal.errors.notFound' as const);
  }
  async publicRecord(pollId: PollId) {
    const loaded = await this.published(pollId);

    if (!loaded.success) {
      return loaded;
    }

    const seal = loaded.value;

    return success({
      manifest: seal.manifest,
      rootDigest: seal.rootDigest,
      status: publicAnchor(seal.anchor),
    });
  }
  async proof(pollId: PollId) {
    const loaded = await this.published(pollId);

    if (!loaded.success) {
      return loaded;
    }

    const anchor = loaded.value.anchor;
    const proof = anchor?.confirmedProof ?? anchor?.pendingProof;

    if (!proof || !anchor) {
      return failure('seal.errors.anchorUnavailable' as const);
    }

    return success({
      bytes: proof,
      status: anchor.confirmedProof
        ? 'bitcoin'
        : anchor.provider === 'stub'
          ? 'simulated'
          : 'pending',
    });
  }
  async sections(pollId: PollId, userId: UserId) {
    const allowed = await this.permissions.forViewer(pollId, userId);

    if (!allowed.success) {
      return allowed;
    }

    if (!allowed.value.results) {
      return failure('seal.errors.forbidden' as const);
    }

    const loaded = await this.load(pollId);

    if (!loaded.success) {
      return loaded;
    }

    const { sections, votes, manifest, rootDigest } = loaded.value.record;

    return success({
      manifest,
      rootDigest,
      sections: {
        poll: sections.poll,
        tallies: sections.tallies,
        ...(allowed.value.names ? { register: sections.register, votes } : {}),
        ...(allowed.value.signers ? { signers: sections.signers } : {}),
      },
    });
  }
  async myProof(pollId: PollId, userId: UserId) {
    const loaded = await this.load(pollId);

    if (!loaded.success) {
      return loaded;
    }

    const { sections, votes, manifest, rootDigest } = loaded.value.record;
    const own = votes.filter((v) => v.preimage.userId === userId);

    if (own.length === 0) {
      return failure('seal.errors.notAVoter' as const);
    }

    const allowed = await this.permissions.forViewer(pollId, userId);

    if (!allowed.success) {
      return allowed;
    }

    const tree = MerkleTree.build(votes.map((v) => Digest.parse(v.hash)));

    return success({
      manifest,
      rootDigest,
      leaves: own.map((v) => ({
        preimage: v.preimage,
        hash: v.hash,
        path: tree.pathFor(Digest.parse(v.hash)),
      })),
      ...(allowed.value.results ? { poll: sections.poll } : {}),
    });
  }
}
