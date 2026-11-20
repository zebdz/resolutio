/** Transaction-scoped seal persistence. Immutable canonical bytes are stored verbatim;
 * every write rechecks the fenced owner under the same transaction's row lock. */
import { Prisma } from '@/generated/prisma/client';
import { PollSealRepository } from '@/domain/seal/PollSealRepository';
import { PollSeal } from '@/domain/seal/PollSeal';
import { SealPersistenceFailureCode as Failure } from '@/domain/seal/SealPersistenceFailureCode';
import { FencingToken } from '@/domain/seal/SealValues';
import { failure, success } from '@/domain/shared/Result';
import { SealWorkClaim } from '@/application/seal/SealWorkRepository';
import { lockSealWorkClaim } from './PrismaSealWorkRepository';

import { PrismaSealReader } from './PrismaSealReader';
export class PrismaPollSealRepository
  extends PrismaSealReader
  implements PollSealRepository
{
  constructor(
    tx: Prisma.TransactionClient,
    private readonly claim: SealWorkClaim
  ) {
    super(tx);
  }
  protected override queryFailure(error: unknown) {
    // The transaction owner retries conflicts with a fresh repeatable-read snapshot.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      ['P2002', 'P2034'].includes(error.code)
    ) {
      throw error;
    }

    return super.queryFailure(error);
  }

  async save(seal: PollSeal): ReturnType<PollSealRepository['save']> {
    if (seal.pollId !== this.claim.pollId) {
      return failure(Failure.parse('seal.errors.claimLost'));
    }

    const ownership = await lockSealWorkClaim(this.tx, this.claim);

    if (!ownership.success) {
      return failure(Failure.parse(ownership.error));
    }

    const record = seal.record;
    // No update branch: a second worker can only read the original seal.
    await this.tx.pollSeal.createMany({
      data: [
        {
          pollId: seal.pollId,
          rootDigest: seal.rootDigest,
          manifest: record.manifest,
          sectionPoll: record.sections.poll,
          sectionTallies: record.sections.tallies,
          sectionRegister: record.sections.register,
          sectionSigners: record.sections.signers,
          votes: record.votes.map((v) => ({
            hash: v.hash,
            preimage: { ...v.preimage },
          })),
          sealedAt: new Date(seal.manifest.sealedAt),
        },
      ],
      skipDuplicates: true,
    });

    return success(undefined);
  }
  async saveAnchors(
    seal: PollSeal,
    token: FencingToken
  ): ReturnType<PollSealRepository['saveAnchors']> {
    if (seal.pollId !== this.claim.pollId || token !== this.claim.token) {
      return failure(Failure.parse('seal.errors.claimLost'));
    }

    const ownership = await lockSealWorkClaim(this.tx, this.claim);

    if (!ownership.success) {
      return failure(Failure.parse(ownership.error));
    }

    const stored = await this.tx.pollSeal.findUnique({
      where: { pollId: seal.pollId },
      select: { rootDigest: true },
    });

    if (stored?.rootDigest !== seal.rootDigest) {
      return failure(Failure.parse('domain.seal.inconsistentRecord'));
    }

    // Supersede first so the partial unique index permits the replacement.
    const anchors = seal.anchors.sort(
      (a, b) =>
        Number(b.status === 'SUPERSEDED') - Number(a.status === 'SUPERSEDED')
    );

    for (const a of anchors) {
      const data = {
        provider: a.provider,
        status: a.status,
        pendingProof: a.pendingProof ? new Uint8Array(a.pendingProof) : null,
        confirmedProof: a.confirmedProof
          ? new Uint8Array(a.confirmedProof)
          : null,
        bitcoinHeight: a.bitcoinHeight,
        bitcoinTime: a.bitcoinTime ? new Date(a.bitcoinTime) : null,
        attempts: a.attempts,
        lastError: a.lastError,
        nextAttemptAt: a.nextAttemptAt ? new Date(a.nextAttemptAt) : null,
        submittedAt: a.submittedAt ? new Date(a.submittedAt) : null,
        confirmedAt: a.confirmedAt ? new Date(a.confirmedAt) : null,
        createdAt: new Date(a.createdAt),
      };
      const previous = await this.tx.sealAnchor.findUnique({
        where: { id: a.id },
        select: { pollId: true },
      });

      if (previous && previous.pollId !== seal.pollId) {
        return failure(Failure.parse('domain.seal.inconsistentRecord'));
      }

      await this.tx.sealAnchor.upsert({
        where: { id: a.id },
        create: { id: a.id, pollId: seal.pollId, ...data },
        update: data,
      });
    }

    return success(undefined);
  }
}
