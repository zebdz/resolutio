/** Read exact persisted seal bytes and validate record, identity and anchor states
 * before any disclosure. This reader needs no worker claim or write capability. */
import { z } from 'zod';
import { SealExportReader } from '@/application/seal/SealExports';
import { parseAnchor } from '@/domain/seal/SealAnchor';
import { requireSeal, sealResult } from '@/domain/seal/SealDomainCodes';
import { hashText } from '@/domain/seal/Hash';
import { readManifest } from '@/domain/seal/RecordValidation';
import { Prisma, SealAnchor as AnchorRow } from '@/generated/prisma/client';
import { PollSealRepository } from '@/domain/seal/PollSealRepository';
import { PollSeal } from '@/domain/seal/PollSeal';
import { SealPersistenceFailureCode as Failure } from '@/domain/seal/SealPersistenceFailureCode';
import { Digest, PollId } from '@/domain/seal/SealValues';
import { votePreimageSchema, votePreimageData } from '@/domain/seal/VoteLeaf';
import { failure, success } from '@/domain/shared/Result';
const votesSchema = z.array(
  z.strictObject({ hash: Digest.schema, preimage: votePreimageSchema })
);

function anchorData(a: AnchorRow) {
  return {
    id: a.id,
    provider: a.provider,
    status: a.status,
    pendingProof: a.pendingProof,
    confirmedProof: a.confirmedProof,
    bitcoinHeight: a.bitcoinHeight,
    bitcoinTime: a.bitcoinTime?.toISOString() ?? null,
    attempts: a.attempts,
    lastError: a.lastError,
    nextAttemptAt: a.nextAttemptAt?.toISOString() ?? null,
    submittedAt: a.submittedAt?.toISOString() ?? null,
    confirmedAt: a.confirmedAt?.toISOString() ?? null,
    createdAt: a.createdAt.toISOString(),
  };
}

export class PrismaSealReader implements SealExportReader {
  constructor(protected readonly tx: Prisma.TransactionClient) {}
  async findPublishedByPollId(
    pollId: PollId
  ): ReturnType<SealExportReader['findPublishedByPollId']> {
    const row = await this.tx.pollSeal.findUnique({
      where: { pollId },
      select: {
        manifest: true,
        rootDigest: true,
        sealedAt: true,
        anchors: { where: { status: { not: 'SUPERSEDED' } }, take: 1 },
      },
    });

    if (!row) {
      return success(null);
    }

    const result = sealResult(() => {
      const manifest = readManifest(row.manifest);
      const digest = hashText(row.manifest);
      requireSeal(
        manifest.pollId === pollId &&
          digest === row.rootDigest &&
          manifest.sealedAt === row.sealedAt.toISOString()
      );

      return {
        manifest: row.manifest,
        rootDigest: digest,
        anchor: row.anchors[0]
          ? parseAnchor(anchorData(row.anchors[0]), manifest.sealedAt)
          : null,
      };
    });

    return result.success ? result : failure(Failure.parse(result.error));
  }
  async findByPollId(
    pollId: PollId
  ): ReturnType<PollSealRepository['findByPollId']> {
    return this.load({ pollId });
  }
  async findByRootDigest(
    rootDigest: Digest
  ): ReturnType<PollSealRepository['findByRootDigest']> {
    return this.load({ rootDigest });
  }
  private async load(
    where: Prisma.PollSealWhereUniqueInput
  ): ReturnType<PollSealRepository['findByPollId']> {
    const row = await this.tx.pollSeal.findUnique({
      where,
      include: { anchors: { orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] } },
    });

    if (!row) {
      return success(null);
    }

    const votes = votesSchema.safeParse(row.votes);

    if (!votes.success) {
      return failure(Failure.parse('domain.seal.inconsistentRecord'));
    }

    const decoded = PollSeal.reconstitute(
      {
        manifest: row.manifest,
        rootDigest: row.rootDigest,
        sections: {
          poll: row.sectionPoll,
          tallies: row.sectionTallies,
          register: row.sectionRegister,
          signers: row.sectionSigners,
        },
        votes: votes.data.map((v) => ({
          hash: v.hash,
          preimage: votePreimageData(v.preimage),
        })),
      },
      row.anchors.map(anchorData)
    );

    if (!decoded.success) {
      return failure(Failure.parse(decoded.error));
    }

    if (
      decoded.value.pollId !== row.pollId ||
      decoded.value.manifest.sealedAt !== row.sealedAt.toISOString()
    ) {
      return failure(Failure.parse('domain.seal.inconsistentRecord'));
    }

    return decoded;
  }
}
